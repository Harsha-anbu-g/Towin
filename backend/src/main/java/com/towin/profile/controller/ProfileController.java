package com.towin.profile.controller;

import com.towin.common.service.S3Service;
import com.towin.profile.dto.*;
import com.towin.profile.service.ProfileService;
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
        // the connections endpoint instead).
        boolean isSelf = auth != null && id.toString().equals(auth.getName());
        return ResponseEntity.ok(profileService.getProfile(id, isSelf));
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
}
