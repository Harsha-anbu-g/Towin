package com.towinly.assistant.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What LlmClient reads out of a chat-completions response: the words, and the
 * token usage the API bills. Fed as maps so no HTTP call is needed.
 */
class LlmClientParseTest {

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

        Optional<LlmReply> reply = LlmClient.parse(response);

        assertThat(reply).isPresent();
        assertThat(reply.get().text()).isEqualTo("Hello there.");
        assertThat(reply.get().promptTokens()).isEqualTo(4641);
        assertThat(reply.get().completionTokens()).isEqualTo(1817);
        assertThat(reply.get().cachedTokens()).isEqualTo(4608);
        assertThat(reply.get().totalTokens()).isEqualTo(6458);
    }

    @Test
    void missingUsage_readsAsZero_andStillAnswers() {
        Optional<LlmReply> reply = LlmClient.parse(choices("Hello."));

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

        LlmReply reply = LlmClient.parse(response).orElseThrow();

        assertThat(reply.promptTokens()).isEqualTo(10);
        assertThat(reply.completionTokens()).isEqualTo(5);
        assertThat(reply.cachedTokens()).isZero();
    }

    @Test
    void usageThatIsNotANumber_readsAsZero() {
        Map<String, Object> response = Map.of(
                "choices", choices("Hello.").get("choices"),
                "usage", Map.of("prompt_tokens", "lots", "completion_tokens", 5));

        LlmReply reply = LlmClient.parse(response).orElseThrow();

        assertThat(reply.promptTokens()).isZero();
        assertThat(reply.completionTokens()).isEqualTo(5);
    }

    @Test
    void noText_isEmpty_whateverTheUsageSays() {
        Map<String, Object> response = Map.of(
                "choices", choices("   ").get("choices"),
                "usage", Map.of("prompt_tokens", 10, "completion_tokens", 0));

        assertThat(LlmClient.parse(response)).isEmpty();
        assertThat(LlmClient.parse(null)).isEmpty();
        assertThat(LlmClient.parse(Map.of())).isEmpty();
    }
    @Test
    void readsToolCalls_whenTheModelAsksForOne() {
        Map<String, Object> message = new java.util.HashMap<>();
        message.put("role", "assistant");
        message.put("content", null);
        message.put("reasoning", "They ask about their helpers, so look up the connections.");
        message.put("tool_calls", List.of(Map.of(
                "id", "call_1", "type", "function",
                "function", Map.of("name", "get_my_connections", "arguments", "{}"))));
        Map<String, Object> response = Map.of(
                "choices", List.of(Map.of("message", message)),
                "usage", Map.of("prompt_tokens", 100, "completion_tokens", 7));

        LlmReply reply = LlmClient.parse(response).orElseThrow();

        assertThat(reply.text()).isEmpty();
        assertThat(reply.hasToolCalls()).isTrue();
        assertThat(reply.toolCalls()).containsExactly(new LlmReply.ToolCall("call_1", "get_my_connections", "{}"));
        assertThat(reply.reasoning()).isEqualTo("They ask about their helpers, so look up the connections.");
        assertThat(reply.promptTokens()).isEqualTo(100);
    }

    @Test
    void aPlainAnswer_hasNoReasoning_whenNoneWasSent() {
        assertThat(LlmClient.parse(choices("Hello.")).orElseThrow().reasoning()).isNull();
    }

    @Test
    void aPlainAnswer_hasNoToolCalls() {
        LlmReply reply = LlmClient.parse(choices("Hello.")).orElseThrow();

        assertThat(reply.hasToolCalls()).isFalse();
        assertThat(reply.toolCalls()).isEmpty();
    }

    @Test
    void addingTokensOf_sumsBothCalls_andKeepsThisText() {
        LlmReply first = new LlmReply("", 4000, 20, 3800, List.of(new LlmReply.ToolCall("c", "t", "{}")));
        LlmReply second = new LlmReply("Here you go.", 4300, 90, 4000);

        LlmReply whole = second.addingTokensOf(first);

        assertThat(whole.text()).isEqualTo("Here you go.");
        assertThat(whole.promptTokens()).isEqualTo(8300);
        assertThat(whole.completionTokens()).isEqualTo(110);
        assertThat(whole.cachedTokens()).isEqualTo(7800);
        assertThat(whole.toolCalls()).isEmpty();
    }

    @Test
    void messageHelpers_buildTheShapesTheApiExpects() {
        List<Map<String, Object>> turns = LlmClient.toMessages(List.of(
                new com.towinly.assistant.dto.ChatMessage("user", "Hi"),
                new com.towinly.assistant.dto.ChatMessage("assistant", "Hello")));
        assertThat(turns).containsExactly(
                Map.of("role", "user", "content", "Hi"),
                Map.of("role", "assistant", "content", "Hello"));

        LlmReply.ToolCall call = new LlmReply.ToolCall("call_1", "get_my_family", "{}");
        List<Map<String, Object>> echoed = List.of(Map.of("id", "call_1", "type", "function",
                "function", Map.of("name", "get_my_family", "arguments", "{}")));

        // The echoed assistant turn: content is always a string, even when the model only
        // called a tool, and a vendor's reasoning field (Groq's gpt-oss) rides back with it.
        LlmReply withReasoning = new LlmReply("", 1, 1, 0, List.of(call), "Look up the family first.");
        assertThat(LlmClient.toolCallTurn(withReasoning)).isEqualTo(Map.of(
                "role", "assistant",
                "content", "",
                "reasoning", "Look up the family first.",
                "tool_calls", echoed));

        LlmReply withoutReasoning = new LlmReply("One moment.", 1, 1, 0, List.of(call));
        assertThat(LlmClient.toolCallTurn(withoutReasoning)).isEqualTo(Map.of(
                "role", "assistant",
                "content", "One moment.",
                "tool_calls", echoed));

        // OpenAI's tool turn has no name field: the call id says which tool answered.
        assertThat(LlmClient.toolResultTurn(call, "No family linked.")).isEqualTo(Map.of(
                "role", "tool", "tool_call_id", "call_1", "content", "No family linked."));
    }
}
