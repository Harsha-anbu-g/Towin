package com.towin.auth.service;

import com.towin.auth.dto.*;
import com.towin.auth.security.JwtUtil;
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

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (request.getRole() != UserRole.ELDER
                && request.getRole() != UserRole.HELPER
                && request.getRole() != UserRole.BOTH) {
            throw new IllegalArgumentException("Role must be ELDER, HELPER, or BOTH");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("Phone already registered");
        }

        User user = User.builder()
                .email(request.getEmail())
                .phone(request.getPhone())
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
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, user.getRole().name(), user.getId().toString());
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
