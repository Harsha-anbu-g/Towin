package com.towin.admin.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminReviewResponse {
    private UUID id;
    private String reviewerEmail;
    private String revieweeEmail;
    private int rating;
    private String[] tags;
    private String comment;
    private boolean safetyConcern;
    private LocalDateTime createdAt;
}
