package com.towinly.report.dto;

import com.towinly.common.enums.ReportedContent;
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

    /**
     * Optional, and only ever sent as a pair: which one thing this is about.
     *
     * Both are checked in {@code ReportService} rather than here, because the interesting
     * question is not "is this a UUID" but "is this a real piece of writing, that this
     * reporter was actually shown, by the person they are naming" — and a bean annotation
     * cannot ask any of that.
     */
    private ReportedContent contentType;

    private UUID contentId;
}
