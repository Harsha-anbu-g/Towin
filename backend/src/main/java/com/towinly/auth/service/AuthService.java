package com.towinly.auth.service;

import com.towinly.auth.dto.*;
import com.towinly.auth.security.JwtUtil;
import com.towinly.auth.security.LoginRateLimiter;
import com.towinly.auth.security.OtpRateLimiter;
import com.towinly.auth.security.PasswordPolicy;
import com.towinly.common.entity.PendingRegistration;
import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.PendingRegistrationRepository;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.EmailService;
import com.towinly.common.service.PostHogService;
import com.towinly.common.service.S3Service;
import com.towinly.common.service.TrustScoreService;
import com.towinly.emergency.service.SosService;
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
     *
     * <p>It never says whether the address or the handle already belongs to somebody
     * (SEC-08). Towinly's members are elderly, and being one implies living alone and
     * letting strangers in, so "is this person registered?" is a targeting question,
     * and an email list plus this endpoint used to answer it in bulk. Login and
     * forgot-password have always answered everybody the same way; this now matches
     * them. A duplicate is settled through the inbox instead: the address that already
     * exists is written to, and the caller — who may be anybody — is told nothing.
     */
    @Transactional
    public void register(RegisterRequest request) {
        if (request.getRole() != UserRole.ELDER
                && request.getRole() != UserRole.HELPER
                && request.getRole() != UserRole.BOTH
                && request.getRole() != UserRole.FAMILY) {
            throw new IllegalArgumentException("Role must be ELDER, HELPER, BOTH, or FAMILY");
        }
        // The password is judged BEFORE the address is looked at, on purpose: if the
        // duplicate-email return came first, a deliberately weak password would draw
        // no complaint for a member and "too weak" for a stranger, which is the same
        // oracle by another door.
        passwordPolicy.validate(request.getPassword(), request.getUsername(), request.getEmail());

        // Hashed on every path, including the duplicate one below. Bcrypt is by far the
        // slowest thing register does, so skipping it for a known address would let a
        // stopwatch answer the question the response refuses to.
        String passwordHash = passwordEncoder.encode(request.getPassword());

        // Anti-enumeration (SEC-08): an address that already belongs to an account
        // gets the very same answer a fresh one does. Saying "Email already
        // registered" confirmed which people on a list were members. Nothing is
        // written and no mail is sent, so no second account exists and the owner of
        // the address is not troubled by a stranger's attempt. login and
        // forgotPassword above already work this way; this path was the outlier.
        if (userRepository.existsByEmail(request.getEmail())) {
            // The caller is told nothing, but the address's real owner is: a person
            // who simply forgot they had an account would otherwise wait forever for
            // a verification mail that is never coming, with no way to find out why.
            // The note goes only to the address that already exists, so it tells a
            // stranger nothing, and it carries the way back in.
            emailService.sendAlreadyRegisteredEmail(request.getEmail(), verifyBaseUrl + "/login");
            return;
        }
        // Deliberately no existsByUsername check here - that was the same probe wearing a
        // different hat ("Username already taken" answered a stranger's question about a
        // name they read off a profile). verifyEmail still enforces uniqueness, and by
        // then the answer is going to whoever opened the link in that mailbox.

        // Replace any earlier unverified attempt for this email so re-registering just refreshes the link.
        pendingRepository.deleteByEmail(request.getEmail());

        String verificationToken = newVerificationToken();
        PendingRegistration pending = PendingRegistration.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordHash)
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
        String email = "guest-" + suffix + "@towinly.beta";
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
        // Signup stopped answering this (see register), so a clash lands here instead.
        // Saying it plainly is safe now: this link reached one mailbox, and whoever opened
        // it is holding that mailbox. The staged row goes too — it can never become an
        // account, and leaving it would only let "resend" walk them into the same wall.
        if (userRepository.existsByUsername(pending.getUsername())) {
            pendingRepository.delete(pending);
            throw new IllegalArgumentException(
                    "Username already taken. Please sign up again and pick a different one.");
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
        // Dates the bump, which token_version alone cannot. A reset is the exact move an
        // attacker holding the elder's inbox makes, so this is what freezes her Sealed box
        // for seven days — see SealedBoxService#revealFrozenUntil.
        user.setCredentialChangedAt(LocalDateTime.now());
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
        // The other half of the pair above. A change made from inside the account freezes the
        // Sealed box for the same seven days: from the server's side the two are the same
        // event, and treating the "safe" one as exempt would be the hole worth walking through.
        user.setCredentialChangedAt(LocalDateTime.now());
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
        // Logic extracted to UserIdentifierResolver so family requests reuse the
        // exact login lookup semantics (email / normalized phone / username).
        return com.towinly.common.service.UserIdentifierResolver
                .resolve(userRepository, identifier).orElse(null);
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

        sosService.sendSmsPublic(user.getPhone(), "Your Towinly verification code is: " + otp);
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
