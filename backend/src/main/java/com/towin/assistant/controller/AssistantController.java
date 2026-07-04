package com.towin.assistant.controller;

import com.towin.assistant.dto.ChatRequest;
import com.towin.assistant.dto.ChatResponse;
import com.towin.assistant.service.AssistantService;
import com.towin.auth.security.IpRateLimiter;
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
 * page can get help too — throttled per IP (like feedback) to protect the free
 * Groq quota. When a valid JWT is present, {@code auth} is non-null and answers
 * are personalized from the user's own data.
 */
@RestController
@RequiredArgsConstructor
public class AssistantController {

    private final AssistantService assistantService;
    private final IpRateLimiter ipRateLimiter;

    @PostMapping("/api/assistant/chat")
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request,
            Authentication auth,
            HttpServletRequest http) {
        ipRateLimiter.check(http);
        UUID userId = (auth != null && auth.isAuthenticated()) ? parseUserId(auth.getName()) : null;
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
