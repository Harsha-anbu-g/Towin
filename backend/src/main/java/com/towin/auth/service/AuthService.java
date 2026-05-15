package com.towin.auth.service;

import com.towin.auth.dto.*;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User;
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

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final S3Service s3Service;
    private final SosService sosService;
    private final TrustScoreService trustScoreService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
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
                .build();

        User saved = userRepository.save(user);
        if (saved.getId() == null) {
            throw new IllegalStateException("User ID was not generated after save");
        }
        String id = saved.getId().toString();
        String token = jwtUtil.generateToken(id, saved.getEmail());
        return new AuthResponse(token, saved.getRole().name(), id);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail());
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

        String otp = String.format("%06d", new java.util.Random().nextInt(1_000_000));
        user.setPhoneOtp(otp);
        user.setPhoneOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        sosService.sendSmsPublic(user.getPhone(), "Your ToWin verification code is: " + otp);
    }

    @Transactional
    public void confirmPhoneOtp(UUID userId, String otp) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getPhoneOtp() == null || !user.getPhoneOtp().equals(otp)) {
            throw new IllegalArgumentException("Invalid verification code");
        }
        if (user.getPhoneOtpExpiresAt() == null ||
                user.getPhoneOtpExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Verification code has expired");
        }

        user.setPhoneVerified(true);
        user.setPhoneOtp(null);
        user.setPhoneOtpExpiresAt(null);
        userRepository.save(user);
        trustScoreService.recalculate(userId);
    }
}
