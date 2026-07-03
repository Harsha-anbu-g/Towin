package com.towin.feedback.controller;

import com.towin.auth.security.IpRateLimiter;
import com.towin.feedback.dto.FeedbackRequest;
import com.towin.feedback.dto.FeedbackResponse;
import com.towin.feedback.service.FeedbackService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final IpRateLimiter ipRateLimiter;

    @PostMapping("/api/feedback")
    public ResponseEntity<Void> submit(@Valid @RequestBody FeedbackRequest req, HttpServletRequest http) {
        // Public, unauthenticated endpoint — throttle per IP to stop spam floods.
        ipRateLimiter.check(http);
        feedbackService.submit(req);
        return ResponseEntity.status(201).build();
    }

    @GetMapping("/api/admin/feedback")
    public ResponseEntity<List<FeedbackResponse>> getAll() {
        return ResponseEntity.ok(feedbackService.getAll());
    }
}
