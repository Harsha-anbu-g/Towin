package com.towin.common.security;

import com.towin.auth.security.JwtUtil;
import com.towin.common.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                Claims claims = jwtUtil.extractAllClaims(token);
                String userId = claims.getSubject();
                String role = claims.get("role", String.class);
                if (userId != null) {
                    // The user row is loaded anyway for lastSeenAt, so checking
                    // isActive here is free — a suspended or deleted account
                    // loses its token immediately instead of after 24 h expiry
                    userRepository.findById(UUID.fromString(userId)).ifPresent(user -> {
                        if (Boolean.TRUE.equals(user.getIsActive())) {
                            List<SimpleGrantedAuthority> authorities = role != null
                                    ? List.of(new SimpleGrantedAuthority(role))
                                    : List.of();
                            UsernamePasswordAuthenticationToken auth =
                                    new UsernamePasswordAuthenticationToken(userId, null, authorities);
                            SecurityContextHolder.getContext().setAuthentication(auth);
                            try {
                                user.setLastSeenAt(LocalDateTime.now());
                                userRepository.save(user);
                            } catch (Exception ignored) {
                                // never block the request for a lastSeenAt update
                            }
                        }
                    });
                }
            } catch (JwtException | IllegalArgumentException ignored) {
                // invalid token — leave security context empty
            }
        }
        chain.doFilter(request, response);
    }
}
