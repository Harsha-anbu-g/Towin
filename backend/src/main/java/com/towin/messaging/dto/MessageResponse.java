package com.towin.messaging.dto;

import com.towin.common.enums.MessageChannel;
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
    private MessageChannel channel;
    // FAMILY_UPDATES sender rendering only: name + presigned photo + plain
    // relationship label ("their daughter Sarah", "helper Maria") — never phone/email.
    private String senderName;
    private String senderPhotoUrl;
    private String senderLabel;
    // Guardian mode: the family member who wrote this on the sender's behalf.
    // Null on every message someone sent for themselves. The chat renders it as
    // "Sarah, for Margaret" so a delegated message is never mistaken for the
    // parent's own words.
    private String actedByName;
    /** So the writer's own screen still shows their message as theirs. */
    private UUID actedByUserId;
}
