package com.towinly.passon.controller;

import com.towinly.passon.dto.PassOnFromResponse;
import com.towinly.passon.dto.PassOnItemRequest;
import com.towinly.passon.dto.PassOnItemResponse;
import com.towinly.passon.dto.PassOnMineResponse;
import com.towinly.passon.service.PassOnService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * What an elder passes on: her Story box and her Letters.
 *
 * The caller is read from the session on every single route and never from the request body,
 * so no call here can write in somebody else's name or read a page as somebody else. The
 * Sealed box is not on this controller at all — it is opened only by its owner, against her
 * password, through {@code SealedBoxService}.
 */
@RestController
@RequestMapping("/api/passon")
@RequiredArgsConstructor
public class PassOnController {

    private final PassOnService passOnService;

    /** Her own page — everything she has written, whoever it is for. */
    @GetMapping("/mine")
    public ResponseEntity<PassOnMineResponse> mine(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.mine(userId));
    }

    @PostMapping("/items")
    public ResponseEntity<PassOnItemResponse> create(
            Authentication auth,
            @Valid @RequestBody PassOnItemRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.create(userId, request));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<PassOnItemResponse> update(
            Authentication auth,
            @PathVariable UUID itemId,
            @Valid @RequestBody PassOnItemRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.update(userId, itemId, request));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable UUID itemId) {
        UUID userId = UUID.fromString(auth.getName());
        passOnService.delete(userId, itemId);
        return ResponseEntity.noContent().build();
    }

    /**
     * "From Margaret": what this visitor, and only this visitor, may read of one elder's
     * writing. Every item is checked one at a time by {@code PassOnVisibilityService}.
     */
    @GetMapping("/from/{ownerId}")
    public ResponseEntity<PassOnFromResponse> from(Authentication auth, @PathVariable UUID ownerId) {
        UUID viewerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.from(viewerId, ownerId));
    }
}
