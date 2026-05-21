package com.towin.feedback.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FeedbackRequest {
    private String name;
    private String email;
    private String phone;

    @NotBlank(message = "Message is required")
    private String message;

    private Integer ratingIdea;
    private Integer ratingUi;
    private Integer ratingTheme;
    private Integer ratingSecurity;
    private Integer ratingEaseOfUse;
    private Integer ratingPerformance;
    private Integer ratingOverall;
}
