package com.towin.assistant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * A user's question plus the recent conversation so far. History is capped so a
 * client can't push an unbounded prompt (cost + latency); the service also
 * trims it defensively.
 */
@Data
public class ChatRequest {

    @NotBlank(message = "Please type a question.")
    @Size(max = 1000, message = "Please keep your question under 1000 characters.")
    private String message;

    @Size(max = 12, message = "Conversation is too long.")
    private List<ChatMessage> history;
}
