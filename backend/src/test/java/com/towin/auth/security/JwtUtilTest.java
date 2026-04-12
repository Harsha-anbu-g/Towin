package com.towin.auth.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class JwtUtilTest {

    @Autowired
    private JwtUtil jwtUtil;

    @Test
    void shouldGenerateAndValidateToken() {
        String userId = UUID.randomUUID().toString();
        String token = jwtUtil.generateToken(userId, "test@email.com");

        assertThat(token).isNotBlank();
        assertThat(jwtUtil.isTokenValid(token)).isTrue();
        assertThat(jwtUtil.extractUserId(token)).isEqualTo(userId);
    }

    @Test
    void shouldReturnFalseForInvalidToken() {
        assertThat(jwtUtil.isTokenValid("invalid.token.here")).isFalse();
    }

    @Test
    void shouldExtractEmailFromToken() {
        String token = jwtUtil.generateToken("user-id-123", "hello@test.com");
        assertThat(jwtUtil.extractEmail(token)).isEqualTo("hello@test.com");
    }
}
