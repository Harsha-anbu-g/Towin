package com.towin.feedback.service;

import com.towin.feedback.dto.FeedbackRequest;
import com.towin.feedback.dto.FeedbackResponse;
import com.towin.feedback.entity.Feedback;
import com.towin.feedback.repository.FeedbackRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;

    public void submit(FeedbackRequest req) {
        feedbackRepository.save(Feedback.builder()
            .name(req.getName())
            .email(req.getEmail())
            .phone(req.getPhone())
            .message(req.getMessage())
            .ratingIdea(req.getRatingIdea())
            .ratingUi(req.getRatingUi())
            .ratingTheme(req.getRatingTheme())
            .ratingSecurity(req.getRatingSecurity())
            .ratingEaseOfUse(req.getRatingEaseOfUse())
            .ratingPerformance(req.getRatingPerformance())
            .ratingOverall(req.getRatingOverall())
            .build());
    }

    public List<FeedbackResponse> getAll() {
        return feedbackRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
            .stream()
            .map(f -> FeedbackResponse.builder()
                .id(f.getId())
                .name(f.getName())
                .email(f.getEmail())
                .phone(f.getPhone())
                .message(f.getMessage())
                .ratingIdea(f.getRatingIdea())
                .ratingUi(f.getRatingUi())
                .ratingTheme(f.getRatingTheme())
                .ratingSecurity(f.getRatingSecurity())
                .ratingEaseOfUse(f.getRatingEaseOfUse())
                .ratingPerformance(f.getRatingPerformance())
                .ratingOverall(f.getRatingOverall())
                .createdAt(f.getCreatedAt())
                .build())
            .toList();
    }
}
