package com.towin.feedback.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class FeedbackResponse {
    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String message;
    private Integer ratingIdea;
    private Integer ratingUi;
    private Integer ratingTheme;
    private Integer ratingSecurity;
    private Integer ratingEaseOfUse;
    private Integer ratingPerformance;
    private Integer ratingOverall;
    private LocalDateTime createdAt;
}
