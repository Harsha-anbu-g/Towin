package com.towin.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.towin.auth.dto.AuthResponse;
import com.towin.auth.dto.OAuthCompleteRequest;
import com.towin.auth.oauth.OneTimeCodeStore;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;

    private final OneTimeCodeStore codeStore = new OneTimeCodeStore();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private JwtUtil jwtUtil;
    private OAuthService oauthService;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "test-only-secret-never-used-in-production-safe-to-be-public");
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", 3600000L);
        ReflectionTestUtils.invokeMethod(jwtUtil, "init");
        oauthService = new OAuthService(codeStore, userRepository, jwtUtil, objectMapper, passwordEncoder);
    }

    @Test
    void googleSignInKeepsTokenVersionOfUserWhoChangedPassword() throws Exception {
        // A user who has reset or changed their password has tokenVersion >= 1.
        User existing = User.builder()
                .email("elder@email.com")
                .username("elder1")
                .role(UserRole.ELDER)
                .tokenVersion(3)
                .build();
        existing.setId(UUID.randomUUID());

        when(userRepository.existsByEmail("elder@email.com")).thenReturn(true);
        when(userRepository.findByEmail("elder@email.com")).thenReturn(Optional.of(existing));

        AuthResponse response = oauthService.complete(completeRequest("elder@email.com", "Elder One", "elder1"));

        int claimedVersion = jwtUtil.extractTokenVersion(response.getToken());
        assertThat(claimedVersion).isEqualTo(3);
        // Same check JwtAuthFilter applies on every request — a mismatch means a permanent 401.
        assertThat(claimedVersion).isEqualTo(existing.getTokenVersion());
    }

    @Test
    void googleSignUpMintsTokenVersionZeroForBrandNewUser() throws Exception {
        when(userRepository.existsByEmail("new@email.com")).thenReturn(false);
        when(userRepository.existsByUsername("newbie")).thenReturn(false);
        when(userRepository.existsByPhone("+14165550123")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User toSave = invocation.getArgument(0);
            toSave.setId(UUID.randomUUID());
            return toSave;
        });

        AuthResponse response = oauthService.complete(completeRequest("new@email.com", "New Bie", "newbie"));

        assertThat(jwtUtil.extractTokenVersion(response.getToken())).isZero();
    }

    private OAuthCompleteRequest completeRequest(String email, String name, String username) throws Exception {
        String onboardingToken = codeStore.store(
                objectMapper.writeValueAsString(Map.of("email", email, "name", name)));

        OAuthCompleteRequest request = new OAuthCompleteRequest();
        ReflectionTestUtils.setField(request, "onboardingToken", onboardingToken);
        ReflectionTestUtils.setField(request, "role", UserRole.ELDER);
        ReflectionTestUtils.setField(request, "phone", "+14165550123");
        ReflectionTestUtils.setField(request, "username", username);
        return request;
    }
}
