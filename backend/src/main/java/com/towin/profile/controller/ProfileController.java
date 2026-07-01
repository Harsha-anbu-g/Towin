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
        // Only the owner sees their own raw phone; other users' phone is gated
        // behind the trust journey (exposed via the connections endpoint instead).
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
            @RequestBody Map<String, Object> body) {
        UUID userId = UUID.fromString(auth.getName());
        Double lat = body.get("locationLat") != null ? ((Number) body.get("locationLat")).doubleValue() : null;
        Double lng = body.get("locationLng") != null ? ((Number) body.get("locationLng")).doubleValue() : null;
        String city = body.get("city") instanceof String s ? s : null;
        profileService.updateLocation(userId, lat, lng, city);
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
