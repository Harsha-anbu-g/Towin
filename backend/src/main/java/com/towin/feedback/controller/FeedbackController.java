package com.towin.feedback.controller;

import com.towin.feedback.dto.FeedbackRequest;
import com.towin.feedback.dto.FeedbackResponse;
import com.towin.feedback.service.FeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    @PostMapping("/api/feedback")
    public ResponseEntity<Void> submit(@Valid @RequestBody FeedbackRequest req) {
        feedbackService.submit(req);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/admin/feedback")
    public ResponseEntity<List<FeedbackResponse>> getAll() {
        return ResponseEntity.ok(feedbackService.getAll());
    }
}
