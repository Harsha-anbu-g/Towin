package com.towinly.assistant.service;

import com.towinly.assistant.security.AssistantRateLimiter;
import com.towinly.common.service.PostHogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Books what one Ask AI answer cost: charges the daily token ceiling, writes one
 * log line, and sends one analytics event. Tokens are what Groq bills, so they
 * are the number to watch; a day of Tamil questions costs two to four times the
 * tokens of the same day in English, which no character budget can see.
 *
 * <p>The log line and the event carry counts only: no question text, no reply,
 * and no address. A logged-out visitor is booked under one shared id, so the
 * analytics show the spend and never the person.
 */
@Slf4j
@Component
public class AssistantSpend {

    static final String ANONYMOUS = "anonymous";
    static final String EVENT = "ask_ai_answered";

    private final AssistantRateLimiter rateLimiter;
    private final PostHogService postHog;

    public AssistantSpend(AssistantRateLimiter rateLimiter, PostHogService postHog) {
        this.rateLimiter = rateLimiter;
        this.postHog = postHog;
    }

    /**
     * Records one answered question.
     *
     * @param reply     the answer Groq returned, with its token usage
     * @param language  "en", "fr" or "ta"
     * @param userId    the signed-in user, or null for a visitor
     * @param elapsedMs wall time of the model call
     */
    public void record(GroqReply reply, String language, UUID userId, long elapsedMs) {
        rateLimiter.charge(reply.totalTokens());
        boolean signedIn = userId != null;
        log.info("Ask AI: answered lang={} signedIn={} promptTokens={} completionTokens={} cachedTokens={} ms={}",
                language, signedIn, reply.promptTokens(), reply.completionTokens(), reply.cachedTokens(), elapsedMs);
        postHog.capture(signedIn ? userId.toString() : ANONYMOUS, EVENT, Map.of(
                "language", language,
                "signed_in", signedIn,
                "prompt_tokens", reply.promptTokens(),
                "completion_tokens", reply.completionTokens(),
                "cached_tokens", reply.cachedTokens(),
                "ms", elapsedMs));
    }
}
