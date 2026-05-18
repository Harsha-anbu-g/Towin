package com.towin.streak.controller;

import com.towin.streak.dto.StreakResponse;
import com.towin.streak.service.StreakService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/streaks")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins:http://localhost:5173}")
public class StreakController {

    private final StreakService streakService;

    @GetMapping("/me")
    public ResponseEntity<StreakResponse> getMyStreak(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(streakService.getStreak(userId));
    }

    @PostMapping("/checkin")
    public ResponseEntity<StreakResponse> checkIn(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(streakService.checkIn(userId));
    }
}
