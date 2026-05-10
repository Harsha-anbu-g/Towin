package com.towin.messaging.dto;

import com.towin.common.enums.MessageType;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MessageRequest {
    @NotBlank
    private String content;
    private MessageType type = MessageType.TEXT;
}
