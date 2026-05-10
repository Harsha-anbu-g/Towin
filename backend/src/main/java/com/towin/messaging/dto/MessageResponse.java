package com.towin.messaging.dto;

import com.towin.common.enums.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class MessageResponse {
    private UUID id;
    private UUID connectionId;
    private UUID senderId;
    private String content;
    private MessageType type;
    private LocalDateTime seenAt;
    private boolean flagged;
    private LocalDateTime createdAt;
}
