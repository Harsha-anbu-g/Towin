package com.towin.messaging.controller;

import com.towin.messaging.dto.MessageRequest;
import com.towin.messaging.dto.MessageResponse;
import com.towin.messaging.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping("/{connectionId}")
    public ResponseEntity<Page<MessageResponse>> getHistory(
            @PathVariable UUID connectionId,
            @PageableDefault(size = 30, sort = "createdAt") Pageable pageable,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(messageService.getHistory(connectionId, userId, pageable));
    }

    @PostMapping("/{connectionId}/send")
    public ResponseEntity<MessageResponse> send(
            @PathVariable UUID connectionId,
            @Valid @RequestBody MessageRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(messageService.send(connectionId, userId, request));
    }

    @PostMapping("/{connectionId}/seen")
    public ResponseEntity<Void> markSeen(
            @PathVariable UUID connectionId,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        messageService.markSeen(connectionId, userId);
        return ResponseEntity.noContent().build();
    }
}
