package com.towin.family.controller;

import com.towin.family.dto.FamilyAlertsResponse;
import com.towin.family.dto.FamilyJourneyResponse;
import com.towin.family.dto.FamilyLinkResponse;
import com.towin.family.dto.FamilyLinksResponse;
import com.towin.family.dto.FamilyRequest;
import com.towin.family.dto.FamilyRespondRequest;
import com.towin.family.service.FamilyJourneyService;
import com.towin.family.service.FamilyHelperConnectionService;
import com.towin.family.service.FamilyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/family")
@RequiredArgsConstructor
public class FamilyController {

    private final FamilyService familyService;
    private final FamilyJourneyService familyJourneyService;
    private final FamilyHelperConnectionService familyHelperConnectionService;

    @PostMapping("/requests")
    public ResponseEntity<FamilyLinkResponse> createRequest(
            Authentication auth,
            @Valid @RequestBody FamilyRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.createRequest(userId, request));
    }

    /** Step 4: family member → helper connection request (gated like the updates thread). */
    @PostMapping("/helper-connections")
    public ResponseEntity<com.towin.connection.dto.ConnectionResponse> requestHelperConnection(
            Authentication auth,
            @Valid @RequestBody com.towin.family.dto.HelperConnectionRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyHelperConnectionService.requestHelperConnection(userId, request.getConnectionId()));
    }

    @PostMapping("/requests/{linkId}/respond")
    public ResponseEntity<FamilyLinkResponse> respond(
            Authentication auth,
            @PathVariable UUID linkId,
            @Valid @RequestBody FamilyRespondRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.respond(userId, linkId, Boolean.TRUE.equals(request.getAccept())));
    }

    @DeleteMapping("/links/{linkId}")
    public ResponseEntity<Void> revoke(Authentication auth, @PathVariable UUID linkId) {
        UUID userId = UUID.fromString(auth.getName());
        familyService.revoke(userId, linkId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/links/{linkId}/primary")
    public ResponseEntity<FamilyLinkResponse> setPrimary(Authentication auth, @PathVariable UUID linkId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.setPrimary(userId, linkId));
    }

    @GetMapping("/links")
    public ResponseEntity<FamilyLinksResponse> getLinks(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.getLinks(userId));
    }

    @GetMapping("/journey")
    public ResponseEntity<FamilyJourneyResponse> getJourney(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyJourneyService.getJourney(userId));
    }

    @GetMapping("/alerts")
    public ResponseEntity<FamilyAlertsResponse> getAlerts(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.getAlerts(userId));
    }
}
