package com.towinly.reunion.controller;

import com.towinly.reunion.dto.ChooseOrganiserRequest;
import com.towinly.reunion.dto.OrganiserCandidateDto;
import com.towinly.reunion.dto.ReunionCloseRequest;
import com.towinly.reunion.dto.ReunionGuestRequest;
import com.towinly.reunion.dto.ReunionGuestStateRequest;
import com.towinly.reunion.dto.ReunionPlanRequest;
import com.towinly.reunion.dto.ReunionResponse;
import com.towinly.reunion.dto.ReunionWishRequest;
import com.towinly.reunion.service.ReunionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Reunions: a thin door onto {@link ReunionService}; every rule lives there. */
@RestController
@RequestMapping("/api/reunions")
@RequiredArgsConstructor
public class ReunionController {

    private final ReunionService reunionService;

    @GetMapping("/mine")
    public ResponseEntity<List<ReunionResponse>> mine(Authentication auth) {
        return ResponseEntity.ok(reunionService.listMine(caller(auth)));
    }

    @PostMapping
    public ResponseEntity<ReunionResponse> wish(Authentication auth, @Valid @RequestBody ReunionWishRequest req) {
        return ResponseEntity.ok(reunionService.postWish(caller(auth), req));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReunionResponse> one(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok(reunionService.getOne(caller(auth), id));
    }

    @GetMapping("/{id}/organisers")
    public ResponseEntity<List<OrganiserCandidateDto>> organisers(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok(reunionService.listOrganiserCandidates(caller(auth), id));
    }

    @PostMapping("/{id}/organiser")
    public ResponseEntity<ReunionResponse> chooseOrganiser(Authentication auth, @PathVariable UUID id,
                                                           @Valid @RequestBody ChooseOrganiserRequest req) {
        return ResponseEntity.ok(reunionService.chooseOrganiser(caller(auth), id, req.getOrganiserId()));
    }

    @PostMapping("/{id}/guests")
    public ResponseEntity<ReunionResponse> addGuest(Authentication auth, @PathVariable UUID id,
                                                    @Valid @RequestBody ReunionGuestRequest req) {
        return ResponseEntity.ok(reunionService.addGuest(caller(auth), id, req));
    }

    @PatchMapping("/{id}/guests/{guestId}/state")
    public ResponseEntity<ReunionResponse> setGuestState(Authentication auth, @PathVariable UUID id,
                                                         @PathVariable UUID guestId,
                                                         @Valid @RequestBody ReunionGuestStateRequest req) {
        return ResponseEntity.ok(reunionService.setGuestState(caller(auth), id, guestId, req.getState()));
    }

    @DeleteMapping("/{id}/guests/{guestId}")
    public ResponseEntity<ReunionResponse> removeGuest(Authentication auth, @PathVariable UUID id,
                                                       @PathVariable UUID guestId) {
        return ResponseEntity.ok(reunionService.removeGuest(caller(auth), id, guestId));
    }

    @PutMapping("/{id}/plan")
    public ResponseEntity<ReunionResponse> setPlan(Authentication auth, @PathVariable UUID id,
                                                   @Valid @RequestBody ReunionPlanRequest req) {
        return ResponseEntity.ok(reunionService.setPlan(caller(auth), id, req));
    }

    @PostMapping("/{id}/advance")
    public ResponseEntity<ReunionResponse> advance(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok(reunionService.advance(caller(auth), id));
    }

    @PostMapping("/{id}/guests/{guestId}/arrived")
    public ResponseEntity<ReunionResponse> checkIn(Authentication auth, @PathVariable UUID id,
                                                   @PathVariable UUID guestId) {
        return ResponseEntity.ok(reunionService.checkInGuest(caller(auth), id, guestId));
    }

    @PostMapping("/{id}/guests/{guestId}/home")
    public ResponseEntity<ReunionResponse> home(Authentication auth, @PathVariable UUID id,
                                                @PathVariable UUID guestId) {
        return ResponseEntity.ok(reunionService.confirmGuestHome(caller(auth), id, guestId));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<ReunionResponse> close(Authentication auth, @PathVariable UUID id,
                                                 @Valid @RequestBody(required = false) ReunionCloseRequest req) {
        return ResponseEntity.ok(reunionService.close(caller(auth), id, req == null ? null : req.getThankYou()));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<ReunionResponse> stop(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok(reunionService.stop(caller(auth), id));
    }

    @PostMapping("/{id}/step-down")
    public ResponseEntity<ReunionResponse> stepDown(Authentication auth, @PathVariable UUID id) {
        return ResponseEntity.ok(reunionService.stepDown(caller(auth), id));
    }

    private static UUID caller(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
