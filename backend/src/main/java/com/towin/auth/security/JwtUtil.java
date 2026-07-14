package com.towin.auth.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

@Component
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    private SecretKey key;

    @PostConstruct
    protected void init() {
        if (secret == null || secret.length() < 32)
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String userId, String email, String role, int tokenVersion) {
        return generateToken(userId, email, role, tokenVersion, true);
    }

    public String generateToken(String userId, String email, String role, int tokenVersion, boolean emailVerified) {
        return Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .claim("role", role)
                .claim("tv", tokenVersion)
                .claim("ev", emailVerified)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }

    /**
     * NEW USERS ONLY — hardcodes tokenVersion 0.
     * Only safe for an account that has just been created, where the version genuinely is 0.
     * For any existing user (Google sign-in, password login, …) call the overload above with
     * {@code user.getTokenVersion()}: a token claiming 0 for a user who has ever reset or
     * changed their password is rejected by JwtAuthFilter on every request.
     */
    public String generateToken(String userId, String email, String role) {
        return generateToken(userId, email, role, 0, true);
    }

    public int extractTokenVersion(String token) {
        try {
            Integer tv = parseClaims(token).get("tv", Integer.class);
            return tv != null ? tv : 0;
        } catch (JwtException | IllegalArgumentException e) {
            return -1;
        }
    }

    private io.jsonwebtoken.Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public boolean isTokenValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Optional<String> extractUserId(String token) {
        try {
            return Optional.ofNullable(parseClaims(token).getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public Optional<String> extractEmail(String token) {
        try {
            return Optional.ofNullable(parseClaims(token).get("email", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public Optional<String> extractRole(String token) {
        try {
            return Optional.ofNullable(parseClaims(token).get("role", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public io.jsonwebtoken.Claims extractAllClaims(String token) {
        return parseClaims(token);
    }
}
