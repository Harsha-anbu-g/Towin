package com.towin.common.security;

import com.towin.auth.security.JwtUtil;
import com.towin.common.repository.UserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final ApplicationContext ctx;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.isTokenValid(token)) {
                String userId = jwtUtil.extractUserId(token).orElse(null);
                if (userId != null) {
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(
                                    userId, null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    updateLastSeen(userId);
                }
            }
        }
        chain.doFilter(request, response);
    }

    private void updateLastSeen(String userId) {
        try {
            UserRepository repo = ctx.getBean(UserRepository.class);
            repo.findById(UUID.fromString(userId)).ifPresent(user -> {
                user.setLastSeenAt(LocalDateTime.now());
                repo.save(user);
            });
        } catch (Exception ignored) {
            // never block the request for a lastSeenAt update
        }
    }
}
