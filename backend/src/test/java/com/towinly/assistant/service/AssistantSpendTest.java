package com.towinly.assistant.service;

import com.towinly.assistant.security.AssistantRateLimiter;
import com.towinly.common.service.PostHogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/** What one answered question books: the token charge, and one analytics event. */
class AssistantSpendTest {

    private AssistantRateLimiter limiter;
    private PostHogService postHog;
    private AssistantSpend spend;

    @BeforeEach
    void setUp() {
        limiter = mock(AssistantRateLimiter.class);
        postHog = mock(PostHogService.class);
        spend = new AssistantSpend(limiter, postHog);
    }

    @Test
    void chargesTheDailyTokenCeiling_withPromptPlusCompletion() {
        spend.record(new LlmReply("x", 4000, 120, 0), "en", null, 900);

        verify(limiter).charge(4120);
    }

    @SuppressWarnings("unchecked")
    @Test
    void sendsOneAnalyticsEvent_namingTheUserWhenSignedIn() {
        UUID user = UUID.randomUUID();

        spend.record(new LlmReply("x", 4000, 120, 3800), "ta", user, 1200);

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(postHog).capture(eq(user.toString()), eq("ask_ai_answered"), props.capture());
        assertThat(props.getValue())
                .containsEntry("language", "ta")
                .containsEntry("signed_in", true)
                .containsEntry("prompt_tokens", 4000)
                .containsEntry("completion_tokens", 120)
                .containsEntry("cached_tokens", 3800)
                .containsEntry("ms", 1200L);
    }

    @Test
    void aVisitorIsBookedAsAnonymous_neverByAddress() {
        spend.record(new LlmReply("x", 10, 5, 0), "fr", null, 10);

        verify(postHog).capture(eq("anonymous"), eq("ask_ai_answered"), any());
    }
}
