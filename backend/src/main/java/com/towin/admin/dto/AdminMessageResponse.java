package com.towin.admin.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminMessageResponse {
    private UUID id;
    private String senderEmail;
    private UUID connectionId;
    private String content;
    private LocalDateTime createdAt;
}
