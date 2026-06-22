package com.towin.common.service;

import com.posthog.java.PostHog;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Sends product-analytics events to PostHog. Analytics is optional: when no
 * API key is configured (local dev, CI, tests) the service is a silent no-op,
 * so nothing depends on PostHog being reachable.
 */
@Service
public class PostHogService {

    private final PostHog postHog; // null when analytics is disabled

    @Autowired
    public PostHogService(@Value("${posthog.api-key:}") String apiKey,
                          @Value("${posthog.host:https://us.i.posthog.com}") String host) {
        this((apiKey == null || apiKey.isBlank())
                ? null
                : new PostHog.Builder(apiKey).host(host).build());
    }

    // Visible for testing — lets tests inject a mock (or null) client.
    PostHogService(PostHog postHog) {
        this.postHog = postHog;
    }

    /** Records an event for a user. No-op when disabled or distinctId is null. */
    public void capture(String distinctId, String event, Map<String, Object> properties) {
        if (postHog == null || distinctId == null) {
            return;
        }
        postHog.capture(distinctId, event, properties);
    }

    @PreDestroy
    public void shutdown() {
        if (postHog != null) {
            postHog.shutdown();
        }
    }
}
