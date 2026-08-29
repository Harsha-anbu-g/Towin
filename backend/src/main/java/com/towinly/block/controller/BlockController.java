package com.towinly.block.controller;

import com.towinly.block.dto.BlockRequest;
import com.towinly.block.dto.BlockResponse;
import com.towinly.block.dto.BlockSyncRequest;
import com.towinly.block.service.BlockService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * The block list, per signed-in account (HARD-106). Behind the same JWT gate as every
 * other /api route; a caller only ever reads and writes their own list.
 */
@RestController
@RequestMapping("/api/blocks")
@RequiredArgsConstructor
public class BlockController {

    private final BlockService blockService;

    /** The people I have blocked, newest first. A fresh install hydrates from here. */
    @GetMapping
    public ResponseEntity<List<BlockResponse>> list(Authentication auth) {
        return ResponseEntity.ok(blockService.listBlocked(UUID.fromString(auth.getName())));
    }

    /** Block one person. Idempotent. */
    @PostMapping
    public ResponseEntity<BlockResponse> block(Authentication auth, @Valid @RequestBody BlockRequest request) {
        return ResponseEntity.ok(blockService.block(UUID.fromString(auth.getName()), request.getBlockedUserId()));
    }

    /** Unblock one person. Never an error when they were not blocked. */
    @DeleteMapping("/{blockedUserId}")
    public ResponseEntity<Void> unblock(Authentication auth, @PathVariable UUID blockedUserId) {
        blockService.unblock(UUID.fromString(auth.getName()), blockedUserId);
        return ResponseEntity.noContent().build();
    }

    /** Adopt the list a phone already held; returns the whole list afterwards. */
    @PostMapping("/sync")
    public ResponseEntity<List<BlockResponse>> sync(Authentication auth, @Valid @RequestBody BlockSyncRequest request) {
        return ResponseEntity.ok(blockService.sync(UUID.fromString(auth.getName()), request.getBlockedUserIds()));
    }
}
