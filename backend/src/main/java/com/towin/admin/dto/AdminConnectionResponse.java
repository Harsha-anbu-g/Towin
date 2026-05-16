package com.towin.admin.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminConnectionResponse {
    private UUID id;
    private String userAEmail;
    private String userBEmail;
    private String trustLevel;
    private String status;
    private LocalDateTime createdAt;
}
