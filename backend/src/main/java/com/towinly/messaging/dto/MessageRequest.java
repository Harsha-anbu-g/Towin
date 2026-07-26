package com.towinly.messaging.dto;

import com.towinly.common.enums.MessageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MessageRequest {
    @NotBlank
    @Size(max = 2000)
    private String content;
    private MessageType type = MessageType.TEXT;
}
