package com.towinly.assistant.controller;

import com.towinly.assistant.dto.ChatRequest;
import com.towinly.assistant.dto.ChatResponse;
import com.towinly.assistant.security.AssistantRateLimiter;
import com.towinly.assistant.service.AssistantService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * "Ask AI" tortoise help assistant. Public so logged-out visitors on the landing
 * page can get help too. When a valid JWT is present, {@code auth} is non-null and
 * answers are personalized from the user's own data.
 *
 * <p>Throttled by {@link AssistantRateLimiter} rather than the shared
 * {@link com.towinly.auth.security.IpRateLimiter}. Two reasons: every call here
 * costs money, so it needs a spend ceiling the auth endpoints have no use for; and
 * sharing a limiter coupled the two surfaces, so chatting with the tortoise ate the
 * same per-IP allowance as signing up, and a chat flood could lock a genuine
 * visitor out of registration.
 */
@RestController
@RequiredArgsConstructor
public class AssistantController {

    private final AssistantService assistantService;
    private final AssistantRateLimiter rateLimiter;

    @PostMapping("/api/assistant/chat")
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request,
            Authentication auth,
            HttpServletRequest http) {
        UUID userId = (auth != null && auth.isAuthenticated()) ? parseUserId(auth.getName()) : null;
        // getRemoteAddr(), never X-Forwarded-For: Railway's edge resolves the genuine
        // client address into it, and the header itself is caller-spoofable — parsing
        // it would let an attacker mint a fresh identity per request. See IpRateLimiter.
        rateLimiter.check(userId, http.getRemoteAddr());
        return ResponseEntity.ok(new ChatResponse(assistantService.answer(request, userId)));
    }

    private UUID parseUserId(String name) {
        try {
            return UUID.fromString(name);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
