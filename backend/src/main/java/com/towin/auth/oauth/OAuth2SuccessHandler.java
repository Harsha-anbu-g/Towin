package com.towin.auth.oauth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final OneTimeCodeStore codeStore;
    private final HttpCookieOAuth2AuthorizationRequestRepository cookieRepo;
    private final ObjectMapper objectMapper;

    @Value("${app.oauth.frontend-redirect}")
    private String frontendRedirect;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();
        String email = oauthUser.getAttribute("email");
        String name = oauthUser.getAttribute("name");

        cookieRepo.removeAuthorizationRequestCookies(request, response);

        Optional<User> existing = userRepository.findByEmail(email);
        String code;
        if (existing.isPresent()) {
            User user = existing.get();
            if (!"GOOGLE".equals(user.getAuthProvider())) {
                user.setAuthProvider("GOOGLE");
                userRepository.save(user);
            }
            boolean needsSetup = user.getUsername() == null || user.getPasswordHash() == null;
            if (needsSetup) {
                code = storeCode("ONB", Map.of(
                        "type", "NEEDS_ONBOARDING",
                        "email", email != null ? email : "",
                        "name", name != null ? name : ""
                ));
            } else {
                String jwt = jwtUtil.generateToken(user.getId().toString(), user.getEmail(), user.getRole().name());
                code = storeCode("READY", Map.of("type", "READY", "token", jwt));
            }
        } else {
            code = storeCode("ONB", Map.of(
                    "type", "NEEDS_ONBOARDING",
                    "email", email != null ? email : "",
                    "name", name != null ? name : ""
            ));
        }

        String redirectUrl = UriComponentsBuilder.fromUriString(frontendRedirect)
                .path("/auth/callback")
                .queryParam("code", code)
                .build().toUriString();

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    private String storeCode(String label, Map<String, String> payload) {
        try {
            return codeStore.store(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize OAuth code payload: " + label, e);
        }
    }
}
