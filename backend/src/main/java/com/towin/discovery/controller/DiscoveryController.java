package com.towin.discovery.controller;

import com.towin.discovery.dto.DiscoveredUserResponse;
import com.towin.discovery.dto.DiscoveryFilter;
import com.towin.discovery.service.DiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/discover")
@RequiredArgsConstructor
public class DiscoveryController {

    private final DiscoveryService discoveryService;

    @GetMapping("/elders")
    public ResponseEntity<List<DiscoveredUserResponse>> discoverElders(
            Authentication auth,
            @ModelAttribute DiscoveryFilter filter) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(discoveryService.discoverElders(userId, filter));
    }

    @GetMapping("/helpers")
    public ResponseEntity<List<DiscoveredUserResponse>> discoverHelpers(
            Authentication auth,
            @ModelAttribute DiscoveryFilter filter) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(discoveryService.discoverHelpers(userId, filter));
    }
}
