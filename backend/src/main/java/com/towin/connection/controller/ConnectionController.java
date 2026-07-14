package com.towin.connection.controller;

import com.towin.common.enums.ConnectionStatus;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.dto.ConnectionResponse;
import com.towin.connection.dto.RespondToConnectionRequest;
import com.towin.connection.service.ConnectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
public class ConnectionController {

    private final ConnectionService connectionService;

    @PostMapping("/request")
    public ResponseEntity<ConnectionResponse> sendRequest(
            Authentication auth,
            @Valid @RequestBody ConnectionRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(connectionService.sendRequest(userId, request));
    }

    @PostMapping("/{connectionId}/respond")
    public ResponseEntity<ConnectionResponse> respond(
            Authentication auth,
            @PathVariable UUID connectionId,
            @Valid @RequestBody RespondToConnectionRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(connectionService.respond(userId, connectionId, request));
    }

    @DeleteMapping("/{connectionId}")
    public ResponseEntity<Void> endConnection(
            Authentication auth,
            @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        connectionService.endConnection(userId, connectionId);
        return ResponseEntity.noContent().build();
    }

    // Still a plain array — the dashboards and the inbox filter it client-side — but a
    // bounded one: newest activity first, ?page=&size= to read further back.
    @GetMapping
    public ResponseEntity<List<ConnectionResponse>> getMyConnections(
            Authentication auth,
            @RequestParam(required = false) ConnectionStatus status,
            @PageableDefault(size = ConnectionService.DEFAULT_PAGE_SIZE) Pageable pageable) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(connectionService.getMyConnections(userId, status, pageable));
    }
}
