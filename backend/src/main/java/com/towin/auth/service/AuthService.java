package com.towin.auth.service;

import com.towin.auth.dto.*;
import com.towin.auth.security.JwtUtil;
import com.towin.auth.security.LoginRateLimiter;
import com.towin.auth.security.OtpRateLimiter;
import com.towin.auth.security.PasswordPolicy;
import com.towin.common.entity.PendingRegistration;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.PendingRegistrationRepository;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.EmailService;
import com.towin.common.service.PostHogService;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.emergency.service.SosService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
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
    private final EmailService emailService;
    private final PostHogService postHogService;
    private final PendingRegistrationRepository pendingRepository;
    private final PasswordPolicy passwordPolicy;

    @Value("${app.mail.verify-base-url}")
    private String verifyBaseUrl;

    /**
     * Manual signup. We do NOT create a real account here — we hold the signup in
     * pending_registrations and only create the User when the email link is clicked.
     */
    @Transactional
    public void register(RegisterRequest request) {
        if (request.getRole() != UserRole.ELDER
                && request.getRole() != UserRole.HELPER
                && request.getRole() != UserRole.BOTH
                && request.getRole() != UserRole.FAMILY) {
            throw new IllegalArgumentException("Role must be ELDER, HELPER, BOTH, or FAMILY");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }
        passwordPolicy.validate(request.getPassword(), request.getUsername(), request.getEmail());

        // Replace any earlier unverified attempt for this email so re-registering just refreshes the link.
        pendingRepository.deleteByEmail(request.getEmail());

        String verificationToken = newVerificationToken();
        PendingRegistration pending = PendingRegistration.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole().name())
                .dateOfBirth(request.getDateOfBirth())
                .token(verificationToken)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build();
        pendingRepository.save(pending);

        emailService.sendVerificationEmail(request.getEmail(),
                verifyBaseUrl + "/verify-email?token=" + verificationToken);
        postHogService.capture("pending:" + request.getEmail(), "user_signup_started",
                Map.of("role", request.getRole().name()));
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
                .emailVerified(true)
                .build();

        User saved = userRepository.save(user);
        String id = saved.getId().toString();
        String token = jwtUtil.generateToken(id, saved.getEmail(), saved.getRole().name());
        return new AuthResponse(token, saved.getRole().name(), id);
    }

    public AuthResponse login(LoginRequest request) {
        String id = request.getIdentifier().trim();

        User user = resolveUser(id);
        boolean credentialsOk = user != null && user.getPasswordHash() != null
                && passwordEncoder.matches(request.getPassword(), user.getPasswordHash());

        // The correct password always works, even during a lockout window. This is
        // what prevents a lockout denial-of-service: an attacker spraying wrong
        // guesses at a known email can throttle further *guesses* but can never lock
        // the real owner out of their own account.
        if (credentialsOk) {
            loginRateLimiter.reset(id);
            String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail(),
                    user.getRole().name(), user.getTokenVersion());
            return new AuthResponse(token, user.getRole().name(), user.getId().toString());
        }

        // Wrong credentials: enforce the throttle so a wrong-guess flood is capped.
        loginRateLimiter.checkNotLocked(id);
        loginRateLimiter.recordFailure(id);
        throw new IllegalArgumentException("Invalid credentials");
    }

    /** Clicking the email link is what actually creates the account. */
    @Transactional
    public void verifyEmail(String token) {
        PendingRegistration pending = pendingRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired verification link."));
        if (pending.getExpiresAt() == null || pending.getExpiresAt().isBefore(LocalDateTime.now())) {
            pendingRepository.delete(pending);
            throw new IllegalArgumentException("This verification link has expired. Please sign up again.");
        }
        // Re-check uniqueness at creation time — someone may have taken it since signup.
        if (userRepository.existsByEmail(pending.getEmail())) {
            pendingRepository.delete(pending);
            throw new IllegalArgumentException("Email already registered");
        }
        if (userRepository.existsByUsername(pending.getUsername())) {
            throw new IllegalArgumentException("Username already taken");
        }

        User user = User.builder()
                .username(pending.getUsername())
                .email(pending.getEmail())
                .passwordHash(pending.getPasswordHash())
                .role(UserRole.valueOf(pending.getRole()))
                .dateOfBirth(pending.getDateOfBirth())
                .emailVerified(true)
                .build();
        User saved = userRepository.save(user);
        pendingRepository.delete(pending);
        postHogService.capture(saved.getId().toString(), "user_signed_up",
                Map.of("role", saved.getRole().name()));
    }

    /** Re-send the pending verification link. Anti-enumeration: no-op if no pending signup exists. */
    @Transactional
    public void resendVerification(String email) {
        pendingRepository.findFirstByEmailOrderByCreatedAtDesc(email).ifPresent(pending -> {
            pending.setToken(newVerificationToken());
            pending.setExpiresAt(LocalDateTime.now().plusHours(24));
            pendingRepository.save(pending);
            emailService.sendVerificationEmail(email,
                    verifyBaseUrl + "/verify-email?token=" + pending.getToken());
        });
    }

    private String newVerificationToken() {
        return UUID.randomUUID().toString().replace("-", "")
                + Long.toHexString(SECURE_RANDOM.nextLong());
    }

    /** Email a password-reset link. Anti-enumeration: always returns normally. */
    @Transactional
    public void forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String token = newVerificationToken();
            user.setPasswordResetToken(token);
            user.setPasswordResetExpiresAt(LocalDateTime.now().plusHours(1));
            userRepository.save(user);
            emailService.sendPasswordResetEmail(email, verifyBaseUrl + "/reset-password?token=" + token);
        });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        User user = userRepository.findByPasswordResetToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset link."));
        if (user.getPasswordResetExpiresAt() == null
                || user.getPasswordResetExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("This reset link has expired. Request a new one.");
        }
        passwordPolicy.validate(newPassword, user.getUsername(), user.getEmail());
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1); // invalidate any existing sessions
        user.setPasswordResetToken(null);
        user.setPasswordResetExpiresAt(null);
        userRepository.save(user);
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
        passwordPolicy.validate(request.getNewPassword(), user.getUsername(), user.getEmail());

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }

    /**
     * First-time password for a Google-only account, so it can also sign in with
     * username + password. Refuses if a password already exists — changing one
     * must go through changePassword, which verifies the current password.
     */
    @Transactional
    public void setPassword(UUID userId, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getPasswordHash() != null) {
            throw new IllegalArgumentException("This account already has a password. Use Change Password instead.");
        }
        passwordPolicy.validate(newPassword, user.getUsername(), user.getEmail());

        user.setPasswordHash(passwordEncoder.encode(newPassword));
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
