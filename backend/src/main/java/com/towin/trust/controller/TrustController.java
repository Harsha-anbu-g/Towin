package com.towin.trust.controller;

import com.towin.trust.dto.TrustActionRequest;
import com.towin.trust.dto.TrustStatusResponse;
import com.towin.trust.service.TrustService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/trust")
@RequiredArgsConstructor
public class TrustController {

    private final TrustService trustService;

    @PostMapping("/{connectionId}/confirm")
    public ResponseEntity<TrustStatusResponse> confirm(
            Authentication auth,
            @PathVariable UUID connectionId,
            @RequestBody(required = false) TrustActionRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(trustService.confirmTrustLevel(userId, connectionId, request));
    }

    @PostMapping("/{connectionId}/pause")
    public ResponseEntity<TrustStatusResponse> pause(
            Authentication auth,
            @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(trustService.pauseProgression(userId, connectionId));
    }

    @PostMapping("/{connectionId}/resume")
    public ResponseEntity<TrustStatusResponse> resume(
            Authentication auth,
            @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(trustService.resumeProgression(userId, connectionId));
    }

    @GetMapping("/{connectionId}/status")
    public ResponseEntity<TrustStatusResponse> getStatus(
            Authentication auth,
            @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(trustService.getStatus(userId, connectionId));
    }
}
