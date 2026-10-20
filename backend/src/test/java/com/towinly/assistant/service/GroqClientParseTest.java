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
    @Test
    void readsToolCalls_whenTheModelAsksForOne() {
        Map<String, Object> message = new java.util.HashMap<>();
        message.put("role", "assistant");
        message.put("content", null);
        message.put("tool_calls", List.of(Map.of(
                "id", "call_1", "type", "function",
                "function", Map.of("name", "get_my_connections", "arguments", "{}"))));
        Map<String, Object> response = Map.of(
                "choices", List.of(Map.of("message", message)),
                "usage", Map.of("prompt_tokens", 100, "completion_tokens", 7));

        GroqReply reply = GroqClient.parse(response).orElseThrow();

        assertThat(reply.text()).isEmpty();
        assertThat(reply.hasToolCalls()).isTrue();
        assertThat(reply.toolCalls()).containsExactly(new GroqReply.ToolCall("call_1", "get_my_connections", "{}"));
        assertThat(reply.promptTokens()).isEqualTo(100);
    }

    @Test
    void aPlainAnswer_hasNoToolCalls() {
        GroqReply reply = GroqClient.parse(choices("Hello.")).orElseThrow();

        assertThat(reply.hasToolCalls()).isFalse();
        assertThat(reply.toolCalls()).isEmpty();
    }

    @Test
    void addingTokensOf_sumsBothCalls_andKeepsThisText() {
        GroqReply first = new GroqReply("", 4000, 20, 3800, List.of(new GroqReply.ToolCall("c", "t", "{}")));
        GroqReply second = new GroqReply("Here you go.", 4300, 90, 4000);

        GroqReply whole = second.addingTokensOf(first);

        assertThat(whole.text()).isEqualTo("Here you go.");
        assertThat(whole.promptTokens()).isEqualTo(8300);
        assertThat(whole.completionTokens()).isEqualTo(110);
        assertThat(whole.cachedTokens()).isEqualTo(7800);
        assertThat(whole.toolCalls()).isEmpty();
    }

    @Test
    void messageHelpers_buildTheShapesGroqExpects() {
        List<Map<String, Object>> turns = GroqClient.toMessages(List.of(
                new com.towinly.assistant.dto.ChatMessage("user", "Hi"),
                new com.towinly.assistant.dto.ChatMessage("assistant", "Hello")));
        assertThat(turns).containsExactly(
                Map.of("role", "user", "content", "Hi"),
                Map.of("role", "assistant", "content", "Hello"));

        GroqReply.ToolCall call = new GroqReply.ToolCall("call_1", "get_my_family", "{}");
        assertThat(GroqClient.toolCallTurn(List.of(call))).isEqualTo(Map.of(
                "role", "assistant",
                "tool_calls", List.of(Map.of("id", "call_1", "type", "function",
                        "function", Map.of("name", "get_my_family", "arguments", "{}")))));
        assertThat(GroqClient.toolResultTurn(call, "No family linked.")).isEqualTo(Map.of(
                "role", "tool", "tool_call_id", "call_1", "name", "get_my_family", "content", "No family linked."));
    }
}
