package com.towin.feedback.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FeedbackRequest {
    @Size(max = 120, message = "Name is too long")
    private String name;

    @Email
    @Size(max = 200, message = "Email is too long")
    private String email;

    @Size(max = 40, message = "Phone is too long")
    private String phone;

    @NotBlank(message = "Message is required")
    @Size(max = 5000, message = "Message is too long")
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
