package com.towinly.notification.controller;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.notification.dto.PushTokenRequest;
import com.towinly.notification.entity.PushToken;
import com.towinly.notification.repository.PushTokenRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Where a phone registers itself for pings. Sits behind the same JWT gate as
 * every other /api route. The token is the device's Expo address, not a
 * secret, but it is only ever written for the signed-in caller: nobody can
 * point someone else's notifications at their own phone.
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class PushTokenController {

    /**
     * A person owns a handful of devices, not a thousand. Without this cap an
     * account could loop distinct token strings and grow the shared table
     * without bound (2026-08-16 security review, HIGH). At the cap, the oldest
     * row leaves: the devices someone actually uses re-register on every
     * sign-in, so the stale one is always the right one to evict.
     */
    static final int MAX_TOKENS_PER_USER = 10;

    private final PushTokenRepository pushTokenRepository;
    private final UserRepository userRepository;

    @PostMapping("/token")
    @Transactional
    public ResponseEntity<Void> register(@Valid @RequestBody PushTokenRequest request,
                                         Authentication auth) {
        String token = request.getToken().trim();
        // Expo mints tokens as ExponentPushToken[...] (ExpoPushToken[...] in
        // older SDKs). Anything else can never be delivered, so refuse it here
        // rather than letting Expo reject it silently on every send.
        if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
            return ResponseEntity.badRequest().build();
        }
        UUID userId = UUID.fromString(auth.getName());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String platform = request.getPlatform() == null || request.getPlatform().isBlank()
                ? "ios" : request.getPlatform().trim();

        // Upsert on the token: a device follows whoever is signed in on it.
        PushToken row = pushTokenRepository.findByToken(token)
                .orElseGet(() -> PushToken.builder().token(token).build());
        boolean isNew = row.getId() == null;
        if (isNew) {
            List<PushToken> mine = pushTokenRepository.findAllByUserId(userId);
            if (mine.size() >= MAX_TOKENS_PER_USER) {
                mine.stream()
                        .min(Comparator.comparing(PushToken::getUpdatedAt))
                        .ifPresent(pushTokenRepository::delete);
            }
        }
        row.setUser(user);
        row.setPlatform(platform);
        row.setUpdatedAt(LocalDateTime.now());
        pushTokenRepository.save(row);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/token")
    @Transactional
    public ResponseEntity<Void> unregister(@Valid @RequestBody PushTokenRequest request) {
        // Sign-out path, and deliberately unauthenticated (SecurityConfig
        // permits DELETE on this one path): a phone whose session already
        // expired must still be able to stop ringing for the account that
        // left. Holding the exact token IS the authorization: it is a
        // 200-bit unguessable string that only that device ever saw, so the
        // only thing knowing it lets you do is silence your own phone.
        // Silencing an unknown token is a success, not an error (the goal is
        // already true), which also means the endpoint confirms nothing about
        // which tokens exist.
        pushTokenRepository.findByToken(request.getToken().trim())
                .ifPresent(pushTokenRepository::delete);
        return ResponseEntity.noContent().build();
    }
}
