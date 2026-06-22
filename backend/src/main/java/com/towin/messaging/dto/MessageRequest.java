package com.towin.messaging.dto;

import com.towin.common.enums.MessageType;
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
