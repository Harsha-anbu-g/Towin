package com.towin.auth.controller;

import com.towin.auth.dto.AuthResponse;
import com.towin.auth.dto.OAuthCompleteRequest;
import com.towin.auth.dto.OAuthExchangeRequest;
import com.towin.auth.dto.OAuthExchangeResponse;
import com.towin.auth.service.OAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/oauth")
@RequiredArgsConstructor
public class OAuthController {

    private final OAuthService oauthService;

    /** Frontend calls this immediately on the /auth/callback page with the short-lived code. */
    @PostMapping("/exchange")
    public ResponseEntity<OAuthExchangeResponse> exchange(@Valid @RequestBody OAuthExchangeRequest request) {
        return ResponseEntity.ok(oauthService.exchange(request.getCode()));
    }

    /** New Google users call this after filling in role + phone on the finish-setup screen. */
    @PostMapping("/complete")
    public ResponseEntity<AuthResponse> complete(@Valid @RequestBody OAuthCompleteRequest request) {
        return ResponseEntity.ok(oauthService.complete(request));
    }
}
