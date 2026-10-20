package com.towinly.assistant.service;

/**
 * One answered Groq call: the words, and what they cost in the unit Groq bills.
 * Token counts come from the response's {@code usage} object. A field Groq did
 * not send reads as 0, so accounting can never stop an answer.
 */
public record GroqReply(String text, int promptTokens, int completionTokens, int cachedTokens) {

    /** Prompt plus completion: the number the daily token ceiling counts. */
    public int totalTokens() {
        return promptTokens + completionTokens;
    }
}
