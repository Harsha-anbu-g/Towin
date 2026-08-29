package com.towinly.profile.controller;

import com.towinly.common.service.S3Service;
import com.towinly.profile.dto.*;
import com.towinly.profile.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;
    private final S3Service s3Service;

    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getMyProfile(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(profileService.getProfile(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProfileResponse> getProfile(Authentication auth, @PathVariable UUID id) {
        // Only the owner sees email, phone, date of birth, and sign-in metadata;
        // another user's phone is gated behind the trust journey (exposed via
        // the connections endpoint instead). SEC-06: social handles and gender
        // ride that journey too, so the service is told who is asking rather
        // than a bare yes-or-no about self. A block between the two closes the
        // whole read, which reaches the client as the same 409 the chat and the
        // help request already answer with.
        UUID viewerId = callerId(auth);
        return ResponseEntity.ok(profileService.getProfile(id, viewerId));
    }

    @PutMapping("/elder")
    public ResponseEntity<ProfileResponse> updateElderProfile(
            Authentication auth,
            @Valid @RequestBody ElderProfileRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(profileService.createOrUpdateElderProfile(userId, request));
    }

    @PutMapping("/helper")
    public ResponseEntity<ProfileResponse> updateHelperProfile(
            Authentication auth,
            @Valid @RequestBody HelperProfileRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(profileService.createOrUpdateHelperProfile(userId, request));
    }

    @PutMapping("/phone")
    public ResponseEntity<ProfileResponse> updatePhone(
            Authentication auth,
            @Valid @RequestBody PhoneUpdateRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(profileService.updatePhone(userId, request.getPhone()));
    }

    @PutMapping("/location")
    public ResponseEntity<Void> updateLocation(
            Authentication auth,
            @Valid @RequestBody UpdateLocationRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        // Coordinates may be null (geolocation denied) — the service handles that.
        profileService.updateLocation(userId, request.getLocationLat(), request.getLocationLng(), request.getCity());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/photo")
    public ResponseEntity<Map<String, String>> uploadPhoto(
            Authentication auth,
            @RequestParam("file") MultipartFile file) {
        UUID userId = UUID.fromString(auth.getName());
        String url = s3Service.uploadPhoto(userId, file);
        profileService.updatePhotoUrl(userId, url);
        return ResponseEntity.ok(Map.of("photoUrl", s3Service.presignedUrl(url)));
    }

    /** The signed-in user's id, or null when the principal is missing or not a uuid. */
    private static UUID callerId(Authentication auth) {
        if (auth == null || auth.getName() == null) return null;
        try {
            return UUID.fromString(auth.getName());
        } catch (IllegalArgumentException notAUuid) {
            return null;
        }
    }
}
