package com.towin.review.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class ReviewRequest {

    @NotNull
    private UUID revieweeId;

    private UUID needId;

    @NotNull
    @Min(1) @Max(5)
    private Integer rating;

    private List<String> tags;

    private String comment;

    private boolean safetyConcern = false;
}
