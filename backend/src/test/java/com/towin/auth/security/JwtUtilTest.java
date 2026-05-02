package com.towin.auth.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "test-secret-key-must-be-at-least-32-characters-long");
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", 3600000L);
        jwtUtil.init();
    }

    @Test
    void shouldGenerateAndValidateToken() {
        String userId = UUID.randomUUID().toString();
        String token = jwtUtil.generateToken(userId, "test@email.com");

        assertThat(token).isNotBlank();
        assertThat(jwtUtil.isTokenValid(token)).isTrue();
        assertThat(jwtUtil.extractUserId(token)).contains(userId);
    }

    @Test
    void shouldReturnFalseForInvalidToken() {
        assertThat(jwtUtil.isTokenValid("invalid.token.here")).isFalse();
        assertThat(jwtUtil.extractUserId("invalid.token.here")).isEmpty();
    }

    @Test
    void shouldExtractEmailFromToken() {
        String token = jwtUtil.generateToken("user-id-123", "hello@test.com");
        assertThat(jwtUtil.extractEmail(token)).contains("hello@test.com");
    }
}
