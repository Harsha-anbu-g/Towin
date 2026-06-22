package com.towin.common.service;

import com.posthog.java.PostHog;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

class PostHogServiceTest {

    @Test
    void capture_whenDisabled_doesNotThrow() {
        PostHogService service = new PostHogService((PostHog) null);
        assertThatCode(() ->
                service.capture("user-1", "user_signed_up", Map.of("role", "ELDER")))
                .doesNotThrowAnyException();
    }

    @Test
    void capture_whenEnabled_delegatesToClient() {
        PostHog client = mock(PostHog.class);
        PostHogService service = new PostHogService(client);

        service.capture("user-1", "user_signed_up", Map.of("role", "ELDER"));

        verify(client).capture("user-1", "user_signed_up", Map.of("role", "ELDER"));
    }

    @Test
    void capture_whenDistinctIdNull_doesNotDelegate() {
        PostHog client = mock(PostHog.class);
        PostHogService service = new PostHogService(client);

        service.capture(null, "user_signed_up", Map.of());

        verifyNoInteractions(client);
    }

    @Test
    void shutdown_whenDisabled_doesNotThrow() {
        PostHogService service = new PostHogService((PostHog) null);
        assertThatCode(service::shutdown).doesNotThrowAnyException();
    }
}
