package com.towin.connection.controller;

import com.towin.common.enums.ConnectionStatus;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.dto.ConnectionResponse;
import com.towin.connection.dto.RespondToConnectionRequest;
import com.towin.connection.service.ConnectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

    @GetMapping
    public ResponseEntity<List<ConnectionResponse>> getMyConnections(
            Authentication auth,
            @RequestParam(required = false) ConnectionStatus status) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(connectionService.getMyConnections(userId, status));
    }
}
