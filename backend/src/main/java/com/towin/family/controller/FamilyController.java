package com.towin.family.controller;

import com.towin.family.dto.FamilyLinkResponse;
import com.towin.family.dto.FamilyLinksResponse;
import com.towin.family.dto.FamilyRequest;
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

    @PostMapping("/requests")
    public ResponseEntity<FamilyLinkResponse> createRequest(
            Authentication auth,
            @Valid @RequestBody FamilyRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.createRequest(userId, request));
    }

    @GetMapping("/links")
    public ResponseEntity<FamilyLinksResponse> getLinks(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(familyService.getLinks(userId));
    }
}
