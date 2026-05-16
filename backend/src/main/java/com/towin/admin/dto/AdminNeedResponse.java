package com.towin.admin.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminNeedResponse {
    private UUID id;
    private String elderEmail;
    private String category;
    private String status;
    private LocalDateTime createdAt;
}
