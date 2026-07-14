package com.towin.need.controller;

import com.towin.need.dto.ApplyRequest;
import com.towin.need.dto.NeedRequest;
import com.towin.need.dto.NeedResponse;
import com.towin.need.service.NeedService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/needs")
@RequiredArgsConstructor
public class NeedController {

    private final NeedService needService;

    @GetMapping("/{needId}")
    public ResponseEntity<NeedResponse> getOne(
            Authentication auth,
            @PathVariable UUID needId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.getOne(userId, needId));
    }

    @DeleteMapping("/{needId}")
    public ResponseEntity<Void> cancelNeed(
            Authentication auth,
            @PathVariable UUID needId) {
        UUID userId = UUID.fromString(auth.getName());
        needService.cancelNeed(userId, needId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{needId}/apply")
    public ResponseEntity<Void> withdrawApplication(
            Authentication auth,
            @PathVariable UUID needId) {
        UUID userId = UUID.fromString(auth.getName());
        needService.withdrawApplication(userId, needId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<NeedResponse> postNeed(
            Authentication auth,
            @Valid @RequestBody NeedRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.postNeed(userId, request));
    }

    // Bounded like /nearby, and still a plain array so the helper feed keeps reading it
    // the same way: newest open needs first, ?page=&size= for more.
    @GetMapping("/open")
    public ResponseEntity<List<NeedResponse>> getAllOpen(
            Authentication auth,
            @PageableDefault(size = NeedService.DEFAULT_PAGE_SIZE) Pageable pageable) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.getAllOpen(userId, pageable));
    }

    @GetMapping("/applications")
    public ResponseEntity<List<NeedResponse>> getMyApplications(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.getMyApplications(userId));
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<NeedResponse>> browseNearby(
            Authentication auth,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "10.0") Double radiusKm,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.browseNearby(userId, lat, lng, radiusKm, page, size));
    }

    @GetMapping("/mine")
    public ResponseEntity<Page<NeedResponse>> getMyNeeds(
            Authentication auth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.getMyNeeds(userId, page, size));
    }

    @PostMapping("/{needId}/apply")
    public ResponseEntity<Void> apply(
            Authentication auth,
            @PathVariable UUID needId,
            @RequestBody(required = false) ApplyRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        needService.apply(userId, needId, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{needId}/accept/{helperId}")
    public ResponseEntity<NeedResponse> acceptHelper(
            Authentication auth,
            @PathVariable UUID needId,
            @PathVariable UUID helperId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.acceptHelper(userId, needId, helperId));
    }

    @PostMapping("/{needId}/complete")
    public ResponseEntity<NeedResponse> complete(
            Authentication auth,
            @PathVariable UUID needId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(needService.complete(userId, needId));
    }
}
