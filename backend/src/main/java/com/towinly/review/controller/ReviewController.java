package com.towinly.review.controller;

import com.towinly.review.dto.ReviewRequest;
import com.towinly.review.dto.ReviewResponse;
import com.towinly.review.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping
    public ResponseEntity<ReviewResponse> submitReview(
            Authentication auth,
            @Valid @RequestBody ReviewRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(reviewService.submitReview(userId, request));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<ReviewResponse>> getMyReviews(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(reviewService.getMyReviews(userId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ReviewResponse>> getReviewsForUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(reviewService.getReviewsForUser(userId));
    }

    @GetMapping("/given")
    public ResponseEntity<List<ReviewResponse>> getReviewsGiven(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(reviewService.getReviewsGiven(userId));
    }
}
