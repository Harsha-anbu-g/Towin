package com.towin.family.controller;

import com.towin.common.enums.FamilyStandingState;
import com.towin.family.dto.ElderTransparencyResponse;
import com.towin.family.dto.FamilyAlertsResponse;
import com.towin.family.dto.FamilyJourneyResponse;
import com.towin.family.dto.FamilyLinkResponse;
import com.towin.family.dto.FamilyLinksResponse;
import com.towin.family.dto.FamilyPowersRequest;
import com.towin.family.dto.FamilyRequest;
import com.towin.family.dto.FamilyRespondRequest;
import com.towin.family.dto.FamilyStandingsResponse;
import com.towin.family.service.FamilyJourneyService;
import com.towin.family.service.FamilyService;
import com.towin.family.service.FamilyStandingService;
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
    private final FamilyStandingService familyStandingService;

    @PostMapping("/requests")
    public ResponseEntity<FamilyLinkResponse> createRequest(
            Authentication auth,
            @Valid @RequestBody FamilyRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.createRequest(userId, request));
    }

    /** Transparency: every helper my family can reach — opened chats and
     *  inherited standings alike. Nothing family-facing is hidden from the elder. */
    @GetMapping("/transparency")
    public ResponseEntity<ElderTransparencyResponse> transparency(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyStandingService.transparency(userId));
    }

    /** Trust inheritance: the helpers this family member can reach through
     *  their elders' shared trust. Fully derived — no request, no accept. */
    @GetMapping("/standings")
    public ResponseEntity<FamilyStandingsResponse> standings(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyStandingService.standingsFor(userId));
    }

    /** Open (or reopen) the chat behind a standing; returns the chat connection id. */
    @PostMapping("/standings/{connectionId}/chat")
    public ResponseEntity<UUID> openChat(Authentication auth, @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyStandingService.materializeChat(userId, connectionId));
    }

    /** Open (or reopen) the private chat with a family-linked person — the
     *  parent↔family conversation. Returns the chat connection id. */
    @PostMapping("/chat/{otherUserId}")
    public ResponseEntity<UUID> openFamilyChat(Authentication auth, @PathVariable UUID otherUserId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyStandingService.openFamilyMemberChat(userId, otherUserId));
    }

    @PostMapping("/standings/{connectionId}/pause")
    public ResponseEntity<Void> pauseStanding(Authentication auth, @PathVariable UUID connectionId) {
        familyStandingService.setControl(UUID.fromString(auth.getName()), connectionId, FamilyStandingState.PAUSED);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/standings/{connectionId}/resume")
    public ResponseEntity<Void> resumeStanding(Authentication auth, @PathVariable UUID connectionId) {
        familyStandingService.setControl(UUID.fromString(auth.getName()), connectionId, null);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/standings/{connectionId}/revoke")
    public ResponseEntity<Void> revokeStanding(Authentication auth, @PathVariable UUID connectionId) {
        familyStandingService.setControl(UUID.fromString(auth.getName()), connectionId, FamilyStandingState.REVOKED);
        return ResponseEntity.noContent().build();
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

    /**
     * Guardian mode: the parent sets, in full, what this family member may do for
     * them. Send every power they should keep; anything left out is taken back,
     * and an empty list means they can only look again.
     *
     * The caller is taken from the token, never the body, so only the parent's
     * own session can change this — a family member cannot grant themselves
     * anything by posting here.
     */
    @PutMapping("/links/{linkId}/powers")
    public ResponseEntity<FamilyLinkResponse> setPowers(
            Authentication auth,
            @PathVariable UUID linkId,
            @RequestBody FamilyPowersRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.setDelegatedPowers(userId, linkId, request.getPowers()));
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
