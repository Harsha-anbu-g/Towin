package com.towinly.assistant.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What GroqClient reads out of a chat-completions response: the words, and the
 * token usage Groq bills. Fed as maps so no HTTP call is needed.
 */
class GroqClientParseTest {

    private static Map<String, Object> choices(String content) {
        return Map.of("choices", List.of(Map.of("message", Map.of("role", "assistant", "content", content))));
    }

    @Test
    void readsTheAnswerAndItsTokenUsage() {
        Map<String, Object> response = Map.of(
                "choices", choices(" Hello there. ").get("choices"),
                "usage", Map.of(
                        "prompt_tokens", 4641,
                        "completion_tokens", 1817,
                        "total_tokens", 6458,
                        "prompt_tokens_details", Map.of("cached_tokens", 4608)));

        Optional<GroqReply> reply = GroqClient.parse(response);

        assertThat(reply).isPresent();
        assertThat(reply.get().text()).isEqualTo("Hello there.");
        assertThat(reply.get().promptTokens()).isEqualTo(4641);
        assertThat(reply.get().completionTokens()).isEqualTo(1817);
        assertThat(reply.get().cachedTokens()).isEqualTo(4608);
        assertThat(reply.get().totalTokens()).isEqualTo(6458);
    }

    @Test
    void missingUsage_readsAsZero_andStillAnswers() {
        Optional<GroqReply> reply = GroqClient.parse(choices("Hello."));

        assertThat(reply).isPresent();
        assertThat(reply.get().text()).isEqualTo("Hello.");
        assertThat(reply.get().totalTokens()).isZero();
        assertThat(reply.get().cachedTokens()).isZero();
    }

    @Test
    void usageWithoutCacheDetails_readsCachedAsZero() {
        Map<String, Object> response = Map.of(
                "choices", choices("Hello.").get("choices"),
                "usage", Map.of("prompt_tokens", 10, "completion_tokens", 5));

        GroqReply reply = GroqClient.parse(response).orElseThrow();

        assertThat(reply.promptTokens()).isEqualTo(10);
        assertThat(reply.completionTokens()).isEqualTo(5);
        assertThat(reply.cachedTokens()).isZero();
    }

    @Test
    void usageThatIsNotANumber_readsAsZero() {
        Map<String, Object> response = Map.of(
                "choices", choices("Hello.").get("choices"),
                "usage", Map.of("prompt_tokens", "lots", "completion_tokens", 5));

        GroqReply reply = GroqClient.parse(response).orElseThrow();

        assertThat(reply.promptTokens()).isZero();
        assertThat(reply.completionTokens()).isEqualTo(5);
    }

    @Test
    void noText_isEmpty_whateverTheUsageSays() {
        Map<String, Object> response = Map.of(
                "choices", choices("   ").get("choices"),
                "usage", Map.of("prompt_tokens", 10, "completion_tokens", 0));

        assertThat(GroqClient.parse(response)).isEmpty();
        assertThat(GroqClient.parse(null)).isEmpty();
        assertThat(GroqClient.parse(Map.of())).isEmpty();
    }
}
