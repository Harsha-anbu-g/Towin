package com.towin.auth.controller;

import com.towin.auth.dto.*;
import com.towin.auth.security.IpRateLimiter;
import com.towin.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final IpRateLimiter ipRateLimiter;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request,
                                                 HttpServletRequest http) {
        ipRateLimiter.check(http);
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/guest")
    public ResponseEntity<AuthResponse> guest(@Valid @RequestBody GuestLoginRequest request,
                                              HttpServletRequest http) {
        ipRateLimiter.check(http);
        return ResponseEntity.ok(authService.guestLogin(request.getRole()));
    }

    @PostMapping("/verify-id")
    public ResponseEntity<VerifyIdResponse> verifyId(
            Authentication auth,
            @RequestParam("file") MultipartFile file) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(authService.verifyId(userId, file));
    }

    @PostMapping("/verify-phone/request")
    public ResponseEntity<Void> requestPhoneOtp(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        authService.requestPhoneOtp(userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/verify-phone/confirm")
    public ResponseEntity<Void> confirmPhoneOtp(
            Authentication auth,
            @RequestBody PhoneVerifyRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        authService.confirmPhoneOtp(userId, request.getOtp());
        return ResponseEntity.ok().build();
    }
}
