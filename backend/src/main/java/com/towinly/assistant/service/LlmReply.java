package com.towinly.assistant.service;

import java.util.List;

/**
 * One answered model call: the words, what they cost in the unit the API bills, any
 * tools the model asked to run instead of (or before) answering, and the model's
 * own reasoning when it sent one. Token counts come from the response's
 * {@code usage} object. A field the API did not send reads as 0, so accounting can
 * never stop an answer.
 *
 * <p>{@code reasoning} is what some vendors' reasoning models return beside
 * {@code content}. It is kept only so a tool round can echo the model's turn back
 * whole, as the API documents; it is never shown to anyone and never counted as
 * the answer.
 */
public record LlmReply(String text, int promptTokens, int completionTokens, int cachedTokens,
                        List<ToolCall> toolCalls, String reasoning) {

    /** A tool the model wants run: the API's call id, the function name, the JSON arguments. */
    public record ToolCall(String id, String name, String arguments) {}

    public LlmReply {
        toolCalls = toolCalls == null ? List.of() : List.copyOf(toolCalls);
        reasoning = reasoning == null || reasoning.isBlank() ? null : reasoning;
    }

    /** A reply with tool calls and no reasoning text. */
    public LlmReply(String text, int promptTokens, int completionTokens, int cachedTokens,
                     List<ToolCall> toolCalls) {
        this(text, promptTokens, completionTokens, cachedTokens, toolCalls, null);
    }

    /** A plain answer with no tool calls. */
    public LlmReply(String text, int promptTokens, int completionTokens, int cachedTokens) {
        this(text, promptTokens, completionTokens, cachedTokens, List.of(), null);
    }

    /** Prompt plus completion: the number the daily token ceiling counts. */
    public int totalTokens() {
        return promptTokens + completionTokens;
    }

    public boolean hasToolCalls() {
        return !toolCalls.isEmpty();
    }

    /** This reply's words, with an earlier call's tokens added, so one answer books both calls. */
    public LlmReply addingTokensOf(LlmReply earlier) {
        return new LlmReply(text,
                promptTokens + earlier.promptTokens(),
                completionTokens + earlier.completionTokens(),
                cachedTokens + earlier.cachedTokens(),
                List.of(),
                null);
    }
}
