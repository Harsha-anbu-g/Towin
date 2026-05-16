package com.towin.admin.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminVerificationResponse {
    private UUID userId;
    private String email;
    private String idDocumentUrl;
    private LocalDateTime createdAt;
}
