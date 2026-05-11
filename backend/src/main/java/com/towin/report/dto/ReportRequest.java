package com.towin.report.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ReportRequest {

    @NotNull
    private UUID reportedUserId;

    @NotBlank
    private String reason;

    private String description;
}
