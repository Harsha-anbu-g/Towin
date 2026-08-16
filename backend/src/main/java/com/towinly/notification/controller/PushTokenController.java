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
        row.setUser(user);
        row.setPlatform(platform);
        row.setUpdatedAt(LocalDateTime.now());
        pushTokenRepository.save(row);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/token")
    @Transactional
    public ResponseEntity<Void> unregister(@Valid @RequestBody PushTokenRequest request,
                                           Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        // Sign-out path: only the owner may silence a device, and silencing an
        // unknown token is a success, not an error (the goal is already true).
        pushTokenRepository.findByToken(request.getToken().trim())
                .filter(row -> row.getUser().getId().equals(userId))
                .ifPresent(pushTokenRepository::delete);
        return ResponseEntity.noContent().build();
    }
}
