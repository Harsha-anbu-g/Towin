package com.towinly.assistant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * A user's question plus the recent conversation so far. History is capped so a
 * client can't push an unbounded prompt (cost + latency); the service also
 * trims it defensively.
 *
 * <p>The {@code @Valid} on the list element type is load-bearing: Bean Validation
 * does not descend into collection elements on its own, so without it the
 * per-message caps in {@link ChatMessage} would never run and history would be
 * unbounded in total size no matter what the list-length cap said.
 */
@Data
public class ChatRequest {

    /** One typed question. Matches the composer's maxLength in the browser. */
    public static final int MAX_MESSAGE_CHARS = 1000;

    /** Turns of history a client may send. The service also trims defensively. */
    public static final int MAX_HISTORY_TURNS = 12;

    @NotBlank(message = "Please type a question.")
    @Size(max = MAX_MESSAGE_CHARS, message = "Please keep your question under 1000 characters.")
    private String message;

    @Size(max = MAX_HISTORY_TURNS, message = "Conversation is too long.")
    private List<@Valid ChatMessage> history;
}
