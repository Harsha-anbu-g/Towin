package com.towinly.assistant.service;

import java.util.List;

/**
 * One answered Groq call: the words, what they cost in the unit Groq bills, and
 * any tools the model asked to run instead of (or before) answering. Token counts
 * come from the response's {@code usage} object. A field Groq did not send reads
 * as 0, so accounting can never stop an answer.
 */
public record GroqReply(String text, int promptTokens, int completionTokens, int cachedTokens,
                        List<ToolCall> toolCalls) {

    /** A tool the model wants run: Groq's call id, the function name, the JSON arguments. */
    public record ToolCall(String id, String name, String arguments) {}

    public GroqReply {
        toolCalls = toolCalls == null ? List.of() : List.copyOf(toolCalls);
    }

    /** A plain answer with no tool calls. */
    public GroqReply(String text, int promptTokens, int completionTokens, int cachedTokens) {
        this(text, promptTokens, completionTokens, cachedTokens, List.of());
    }

    /** Prompt plus completion: the number the daily token ceiling counts. */
    public int totalTokens() {
        return promptTokens + completionTokens;
    }

    public boolean hasToolCalls() {
        return !toolCalls.isEmpty();
    }

    /** This reply's words, with an earlier call's tokens added, so one answer books both calls. */
    public GroqReply addingTokensOf(GroqReply earlier) {
        return new GroqReply(text,
                promptTokens + earlier.promptTokens(),
                completionTokens + earlier.completionTokens(),
                cachedTokens + earlier.cachedTokens(),
                List.of());
    }
}
