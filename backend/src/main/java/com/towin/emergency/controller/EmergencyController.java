package com.towin.emergency.controller;

import com.towin.emergency.dto.EmergencyContactRequest;
import com.towin.emergency.dto.EmergencyContactResponse;
import com.towin.emergency.service.EmergencyContactService;
import com.towin.emergency.service.SosService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/emergency")
@RequiredArgsConstructor
public class EmergencyController {

    private final EmergencyContactService contactService;
    private final SosService sosService;

    @GetMapping("/contacts")
    public ResponseEntity<List<EmergencyContactResponse>> listContacts(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(contactService.listContacts(userId));
    }

    @PostMapping("/contacts")
    public ResponseEntity<EmergencyContactResponse> addContact(
            @Valid @RequestBody EmergencyContactRequest request,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(contactService.addContact(userId, request));
    }

    @DeleteMapping("/contacts/{contactId}")
    public ResponseEntity<Void> removeContact(
            @PathVariable UUID contactId,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        contactService.removeContact(contactId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sos")
    public ResponseEntity<Void> triggerSos(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        sosService.triggerSos(userId);
        return ResponseEntity.noContent().build();
    }
}
