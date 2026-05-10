package com.towin.need.controller;

import com.towin.need.dto.ApplyRequest;
import com.towin.need.dto.NeedRequest;
import com.towin.need.dto.NeedResponse;
import com.towin.need.service.NeedService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/needs")
@RequiredArgsConstructor
public class NeedController {

    private final NeedService needService;

    @PostMapping
    public ResponseEntity<NeedResponse> postNeed(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody NeedRequest request) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(needService.postNeed(userId, request));
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<NeedResponse>> browseNearby(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "10.0") Double radiusKm,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(needService.browseNearby(userId, lat, lng, radiusKm, page, size));
    }

    @GetMapping("/mine")
    public ResponseEntity<Page<NeedResponse>> getMyNeeds(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(needService.getMyNeeds(userId, page, size));
    }

    @PostMapping("/{needId}/apply")
    public ResponseEntity<Void> apply(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID needId,
            @RequestBody(required = false) ApplyRequest request) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        needService.apply(userId, needId, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{needId}/accept/{helperId}")
    public ResponseEntity<NeedResponse> acceptHelper(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID needId,
            @PathVariable UUID helperId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(needService.acceptHelper(userId, needId, helperId));
    }

    @PostMapping("/{needId}/complete")
    public ResponseEntity<NeedResponse> complete(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID needId) {
        UUID userId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(needService.complete(userId, needId));
    }
}
