package com.towin.admin.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminReportResponse {
    private UUID id;
    private String reporterEmail;
    private String reportedEmail;
    private String reason;
    private String description;
    private LocalDateTime createdAt;
}
