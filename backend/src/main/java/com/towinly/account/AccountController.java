package com.towinly.account;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Self-service account endpoints for the signed-in user. Identity comes from the
 * JWT (auth.getName()), so a user can only ever export or delete their own data.
 */
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    /** GDPR Article 15 — download everything we hold about you. */
    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportData(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(accountService.exportUserData(userId));
    }

    /**
     * What deleting your account would take with it, to be shown before it happens.
     *
     * The same numbers the admin panel gets, from the same place, because the two delete
     * paths destroy exactly the same rows. Read-only and nothing is removed by calling it.
     */
    @GetMapping("/delete-preview")
    public ResponseEntity<Map<String, Object>> deletePreview(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(accountService.deletionWarning(userId));
    }

    /** GDPR Article 17 — permanently delete your account and all associated data. */
    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        accountService.deleteOwnAccount(userId);
        return ResponseEntity.noContent().build();
    }
}
