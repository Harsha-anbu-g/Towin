package com.towin.auth.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.towin.auth.dto.AuthResponse;
import com.towin.auth.dto.OAuthCompleteRequest;
import com.towin.auth.dto.OAuthExchangeResponse;
import com.towin.auth.oauth.OneTimeCodeStore;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class OAuthService {

    private final OneTimeCodeStore codeStore;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    @Transactional
    public OAuthExchangeResponse exchange(String code) {
        String json = codeStore.consume(code)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired code. Please try signing in again."));

        Map<String, String> parsed = parse(json);
        String type = parsed.get("type");

        if ("READY".equals(type)) {
            return OAuthExchangeResponse.ready(parsed.get("token"));
        }

        if ("NEEDS_ONBOARDING".equals(type)) {
            String email = parsed.get("email");
            String name = parsed.get("name");
            // Store a fresh single-use onboarding token the finish-setup screen will exchange
            Map<String, String> onbPayload = Map.of(
                    "email", email != null ? email : "",
                    "name", name != null ? name : ""
            );
            String onbToken = codeStore.store(toJson(onbPayload));
            return OAuthExchangeResponse.needsOnboarding(onbToken, email, name);
        }

        throw new IllegalStateException("Unknown code type: " + type);
    }

    @Transactional
    public AuthResponse complete(OAuthCompleteRequest request) {
        if (request.getRole() != UserRole.ELDER && request.getRole() != UserRole.HELPER) {
            throw new IllegalArgumentException("Role must be ELDER or HELPER");
        }

        String json = codeStore.consume(request.getOnboardingToken())
                .orElseThrow(() -> new IllegalArgumentException("Session expired. Please sign in with Google again."));

        Map<String, String> parsed = parse(json);
        String email = parsed.get("email");
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Invalid onboarding session.");
        }

        // Auto-link: if a local account with this email already exists, log them in
        if (userRepository.existsByEmail(email)) {
            User existing = userRepository.findByEmail(email).orElseThrow();
            if (!"GOOGLE".equals(existing.getAuthProvider())) {
                existing.setAuthProvider("GOOGLE");
                userRepository.save(existing);
            }
            String jwt = jwtUtil.generateToken(existing.getId().toString(), existing.getEmail(), existing.getRole().name());
            return new AuthResponse(jwt, existing.getRole().name(), existing.getId().toString());
        }

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("This phone number is already registered.");
        }

        User user = User.builder()
                .email(email)
                .phone(request.getPhone())
                .passwordHash(null)
                .role(request.getRole())
                .authProvider("GOOGLE")
                .build();

        User saved = userRepository.save(user);
        String jwt = jwtUtil.generateToken(saved.getId().toString(), saved.getEmail(), saved.getRole().name());
        return new AuthResponse(jwt, saved.getRole().name(), saved.getId().toString());
    }

    private Map<String, String> parse(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse OAuth code payload", e);
        }
    }

    private String toJson(Map<String, String> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize OAuth payload", e);
        }
    }
}
