package com.towin.auth.oauth;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuth2SuccessHandlerTest {

    @Mock UserRepository userRepository;
    @Mock HttpCookieOAuth2AuthorizationRequestRepository cookieRepo;
    @Mock OAuth2User oauthUser;
    @Mock Authentication authentication;

    private final OneTimeCodeStore codeStore = new OneTimeCodeStore();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private JwtUtil jwtUtil;
    private OAuth2SuccessHandler handler;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "test-only-secret-never-used-in-production-safe-to-be-public");
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", 3600000L);
        ReflectionTestUtils.invokeMethod(jwtUtil, "init");
        handler = new OAuth2SuccessHandler(userRepository, jwtUtil, codeStore, cookieRepo, objectMapper);
        ReflectionTestUtils.setField(handler, "frontendRedirect", "http://localhost:5174");
    }

    @Test
    void returningGoogleUserKeepsTokenVersionAfterPasswordChange() throws Exception {
        User user = User.builder()
                .email("elder@email.com")
                .username("elder1")
                .fullName("Elder One")
                .role(UserRole.ELDER)
                .authProvider("GOOGLE")
                .setupCompleted(true)
                .tokenVersion(2)
                .build();
        user.setId(UUID.randomUUID());

        when(oauthUser.getAttribute("email")).thenReturn("elder@email.com");
        when(authentication.getPrincipal()).thenReturn(oauthUser);
        when(userRepository.findByEmail("elder@email.com")).thenReturn(Optional.of(user));

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(request, response, authentication);

        String jwt = readyTokenFrom(response.getRedirectedUrl());
        int claimedVersion = jwtUtil.extractTokenVersion(jwt);
        assertThat(claimedVersion).isEqualTo(2);
        // Same check JwtAuthFilter applies on every request — a mismatch means a permanent 401.
        assertThat(claimedVersion).isEqualTo(user.getTokenVersion());
    }

    private String readyTokenFrom(String redirectedUrl) throws Exception {
        String code = UriComponentsBuilder.fromUriString(redirectedUrl)
                .build().getQueryParams().getFirst("code");
        String json = codeStore.consume(code).orElseThrow();
        Map<String, String> payload = objectMapper.readValue(json, new TypeReference<>() {});
        assertThat(payload.get("type")).isEqualTo("READY");
        return payload.get("token");
    }
}
