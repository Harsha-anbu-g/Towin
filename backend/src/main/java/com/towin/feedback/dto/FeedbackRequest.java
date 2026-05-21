package com.towin.feedback.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FeedbackRequest {
    private String name;
    private String email;
    private String phone;

    @NotBlank(message = "Message is required")
    private String message;

    @Min(1) @Max(5)
    private Integer ratingIdea;
    @Min(1) @Max(5)
    private Integer ratingUi;
    @Min(1) @Max(5)
    private Integer ratingTheme;
    @Min(1) @Max(5)
    private Integer ratingSecurity;
    @Min(1) @Max(5)
    private Integer ratingEaseOfUse;
    @Min(1) @Max(5)
    private Integer ratingPerformance;
    @Min(1) @Max(5)
    private Integer ratingOverall;
}
