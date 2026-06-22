package com.towin.auth.service;

import com.towin.auth.dto.*;
import com.towin.auth.security.JwtUtil;
import com.towin.auth.security.LoginRateLimiter;
import com.towin.auth.security.OtpRateLimiter;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.emergency.service.SosService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int  MAX_OTP_ATTEMPTS = 5;
    private static final long LOCKOUT_MINUTES  = 15;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final S3Service s3Service;
    private final SosService sosService;
    private final TrustScoreService trustScoreService;
    private final LoginRateLimiter loginRateLimiter;
    private final OtpRateLimiter otpRateLimiter;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (request.getRole() != UserRole.ELDER
                && request.getRole() != UserRole.HELPER
                && request.getRole() != UserRole.BOTH) {
            throw new IllegalArgumentException("Role must be ELDER, HELPER, or BOTH");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already taken");
        }

        // Phone is no longer collected at sign-up; users add it later from their profile.
        User user = User.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .dateOfBirth(request.getDateOfBirth())
                .build();

        User saved = userRepository.save(user);
        if (saved.getId() == null) {
            throw new IllegalStateException("User ID was not generated after save");
        }
        String id = saved.getId().toString();
        String token = jwtUtil.generateToken(id, saved.getEmail(), saved.getRole().name());
        return new AuthResponse(token, saved.getRole().name(), id);
    }

    @Transactional
    public AuthResponse guestLogin(UserRole role) {
        if (role != UserRole.ELDER && role != UserRole.HELPER) {
            throw new IllegalArgumentException("Guest role must be ELDER or HELPER");
        }
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String email = "guest-" + suffix + "@towin.beta";
        String phone = "+10000" + suffix.substring(0, 7);
        String password = UUID.randomUUID().toString();

        User user = User.builder()
                .username("guest_" + suffix)
                .email(email)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(password))
                .role(role)
                .build();

        User saved = userRepository.save(user);
        String id = saved.getId().toString();
        String token = jwtUtil.generateToken(id, saved.getEmail(), saved.getRole().name());
        return new AuthResponse(token, saved.getRole().name(), id);
    }

    public AuthResponse login(LoginRequest request) {
        String id = request.getIdentifier().trim();
        loginRateLimiter.checkNotLocked(id);

        User user = resolveUser(id);
        boolean noPassword = user == null || user.getPasswordHash() == null;
        if (noPassword || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            loginRateLimiter.recordFailure(id);
            throw new IllegalArgumentException("Invalid credentials");
        }

        loginRateLimiter.reset(id);
        String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail(), user.getRole().name(), user.getTokenVersion());
        return new AuthResponse(token, user.getRole().name(), user.getId().toString());
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Google-only accounts have no local password to verify against.
        if (user.getPasswordHash() == null) {
            throw new IllegalArgumentException("This account uses Google sign-in, so it has no password to change.");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from your current password.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }

    private User resolveUser(String identifier) {
        if (identifier.contains("@")) {
            return userRepository.findByEmail(identifier).orElse(null);
        }
        // Phone numbers may be typed with spaces, dashes, or parens — strip them so the
        // value matches how it was stored at registration. Phone verification is a trust
        // signal, not an auth gate: the password is what proves identity, so an account
        // can sign in by phone before its number is OTP-verified.
        String phone = identifier.replaceAll("[\\s()-]", "");
        if (phone.startsWith("+") || phone.matches("\\d{10,15}")) {
            return userRepository.findByPhone(phone).orElse(null);
        }
        return userRepository.findByUsername(identifier).orElse(null);
    }

    @Transactional
    public VerifyIdResponse verifyId(UUID userId, MultipartFile file) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String url = s3Service.uploadDocument(userId, file);
        user.setIdDocumentUrl(url);
        user.setVerificationStatus(VerificationStatus.PENDING);
        userRepository.save(user);

        return VerifyIdResponse.builder()
                .documentUrl(url)
                .verificationStatus(VerificationStatus.PENDING.name())
                .build();
    }

    @Transactional
    public void requestPhoneOtp(UUID userId) {
        // Each send fires a paid SMS — rate-limit per user to prevent spam/abuse.
        otpRateLimiter.check(userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String otp = String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
        user.setPhoneOtp(otp);
        user.setPhoneOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        sosService.sendSmsPublic(user.getPhone(), "Your ToWin verification code is: " + otp);
    }

    @Transactional
    public void confirmPhoneOtp(UUID userId, String otp) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid request."));

        if (user.getPhoneOtpLockedAt() != null &&
                user.getPhoneOtpLockedAt().plusMinutes(LOCKOUT_MINUTES).isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException("Too many attempts. Try again in 15 minutes.");
        }

        if (user.getPhoneOtpExpiresAt() == null ||
                user.getPhoneOtpExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Verification code has expired. Request a new one.");
        }

        if (user.getPhoneOtp() == null || !user.getPhoneOtp().equals(otp)) {
            int attempts = user.getPhoneOtpAttempts() + 1;
            user.setPhoneOtpAttempts(attempts);
            if (attempts >= MAX_OTP_ATTEMPTS) {
                user.setPhoneOtpLockedAt(LocalDateTime.now());
                user.setPhoneOtp(null);
            }
            userRepository.save(user);
            throw new IllegalArgumentException("Invalid or expired code.");
        }

        user.setPhoneVerified(true);
        user.setPhoneOtp(null);
        user.setPhoneOtpExpiresAt(null);
        user.setPhoneOtpAttempts(0);
        user.setPhoneOtpLockedAt(null);
        userRepository.save(user);
        trustScoreService.recalculate(userId);
    }
}
