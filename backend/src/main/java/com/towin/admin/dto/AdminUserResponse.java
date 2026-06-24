package com.towin.admin.dto;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminUserResponse {
    private UUID id;
    private String username;
    private String email;
    private String role;
    private Integer trustScore;
    private String trustTier;
    private Boolean isActive;
    private String verificationStatus;
    private boolean phoneVerified;
    private String photoUrl;
    private LocalDateTime createdAt;
}
