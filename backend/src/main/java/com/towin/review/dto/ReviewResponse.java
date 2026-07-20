package com.towin.review.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class ReviewResponse {
    private UUID id;
    private UUID reviewerId;
    private String reviewerName;
    private Integer rating;
    private List<String> tags;
    private String comment;
    private Boolean safetyConcern;
    private LocalDateTime createdAt;
    /** Who wrote this for the reviewer, when it wasn't the reviewer themselves. */
    private String actedByName;
}
