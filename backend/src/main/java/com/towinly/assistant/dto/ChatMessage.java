package com.towinly.assistant.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One turn in the Ask AI conversation. role is "user" or "assistant".
 *
 * <p>The whole history is supplied by the client on every request, so both fields
 * are attacker-controlled and both are bounded here. {@code role} is restricted to
 * the two turn types a real conversation has: without this a caller could label a
 * turn "system" and have their own text delivered to the model as instructions.
 * {@code content} is capped because the {@code @Size} on the history list only
 * limits how many messages arrive, not how big each one is — a dozen
 * multi-megabyte turns would otherwise be forwarded to a metered API.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    /**
     * Comfortably above a real 1000-token reply, far below anything that would
     * bloat the prompt. Rejected outright rather than trimmed, so a client that
     * tampers with history gets a clear 400 instead of a silently altered chat.
     */
    public static final int MAX_CONTENT_CHARS = 4000;

    @Pattern(regexp = "user|assistant", message = "Invalid request.")
    private String role;

    @Size(max = MAX_CONTENT_CHARS, message = "Conversation is too long.")
    private String content;
}
