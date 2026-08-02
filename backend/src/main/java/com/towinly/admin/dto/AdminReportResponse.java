package com.towinly.admin.dto;
import com.towinly.common.enums.ReportedContent;
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
    /**
     * Which one thing this report is about, when it is about a thing and not only a person.
     * Null on a plain "this person" report, which is still most of them.
     */
    private ReportedContent contentType;
    private UUID contentId;
    private LocalDateTime createdAt;
}
