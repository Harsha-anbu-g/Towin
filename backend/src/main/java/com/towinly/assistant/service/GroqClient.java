package com.towinly.assistant.service;

import com.towinly.assistant.dto.ChatMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Thin wrapper over Groq's OpenAI-compatible Chat Completions API. Built like
 * {@link com.towinly.geocoding.GeocodingService}: a RestClient with bounded
 * timeouts, and every failure is swallowed into an empty Optional and logged —
 * the help assistant must never surface a stack trace or hold up a reply.
 *
 * The API key lives only in configuration (env var); it is attached here on the
 * server and never reaches the browser.
 */
@Slf4j
@Component
public class GroqClient {

    private static final long RETRY_DELAY_MS = 700;

    private final RestClient client;
    private final String apiKey;
    private final String model;
    private final boolean enabled;
    private final String reasoningEffort;

    public GroqClient(
            @Value("${groq.base-url:https://api.groq.com/openai/v1}") String baseUrl,
            @Value("${groq.api-key:}") String apiKey,
            @Value("${groq.model:openai/gpt-oss-120b}") String model,
            @Value("${groq.enabled:true}") boolean enabled,
            @Value("${groq.reasoning-effort:low}") String reasoningEffort) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        // A tool round is two calls, and only the first may retry: 9 + 0.7 + 9, then
        // 9 more, stays under the iPhone app's 30 s request timeout. A low-effort
        // answer from Groq normally takes a few seconds.
        factory.setReadTimeout(9000);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.apiKey = apiKey;
        this.model = model;
        this.enabled = enabled;
        this.reasoningEffort = reasoningEffort;
    }

    /** True when a key is present and the assistant is switched on. */
    public boolean isConfigured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }

    /**
     * Sends the system prompt + conversation to Groq and returns the assistant's
     * text with the token usage Groq reports for the call. No tools. Returns empty
     * on any misconfiguration, timeout, or API error so the caller can fall back to
     * a friendly message.
     */
    public Optional<GroqReply> complete(String systemPrompt, List<ChatMessage> conversation) {
        return complete(systemPrompt, toMessages(conversation), null, null, true);
    }

    /**
     * The general call. {@code messages} are the turns after the system prompt, in
     * Groq's own shape (see {@link #toMessages}, {@link #toolCallTurn} and
     * {@link #toolResultTurn}). {@code tools} may be null; {@code toolChoice} is
     * "auto" or "none" when tools are given. {@code retryOnce} allows one quiet
     * retry on a busy moment; the second call of a tool round must not retry, or
     * the whole answer could outrun the app's 30 s timeout.
     */
    public Optional<GroqReply> complete(String systemPrompt, List<Map<String, Object>> messages,
                                        List<Map<String, Object>> tools, String toolChoice, boolean retryOnce) {
        if (!isConfigured()) {
            log.warn("Ask AI called but Groq is not configured (missing key or disabled).");
            return Optional.empty();
        }
        try {
            List<Map<String, Object>> all = new ArrayList<>();
            all.add(Map.of("role", "system", "content", systemPrompt));
            all.addAll(messages);

            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("messages", all);
            body.put("temperature", 0.3);
            body.put("max_tokens", 1000);
            // Reasoning models (gpt-oss) otherwise spend the whole token budget
            // "thinking" and truncate the actual answer. "low" keeps replies direct.
            // Blank omits it, for non-reasoning models that reject the field.
            if (reasoningEffort != null && !reasoningEffort.isBlank()) {
                body.put("reasoning_effort", reasoningEffort);
            }
            if (tools != null && !tools.isEmpty()) {
                body.put("tools", tools);
                if (toolChoice != null) body.put("tool_choice", toolChoice);
            }

            Map<String, Object> response;
            try {
                response = post(body);
            } catch (RestClientException first) {
                if (!retryOnce || !isTransient(first)) throw first;
                // A busy moment at Groq (rate limit, 5xx, a dropped connection) usually
                // clears within a second. One quiet retry turns most of those into an
                // answer instead of "Sorry, I can't answer just now".
                log.info("Ask AI (Groq) transient failure, retrying once: {}", first.getMessage());
                sleep(RETRY_DELAY_MS);
                response = post(body);
            }

            return parse(response);
        } catch (Exception e) {
            log.warn("Ask AI (Groq) call failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** The conversation as Groq message maps: role and content, nothing else. */
    public static List<Map<String, Object>> toMessages(List<ChatMessage> conversation) {
        List<Map<String, Object>> messages = new ArrayList<>();
        for (ChatMessage m : conversation) {
            messages.add(Map.of("role", m.getRole(), "content", m.getContent()));
        }
        return messages;
    }

    /** The assistant turn that carried the tool calls, echoed back before their results. */
    public static Map<String, Object> toolCallTurn(List<GroqReply.ToolCall> calls) {
        List<Map<String, Object>> echoed = new ArrayList<>();
        for (GroqReply.ToolCall c : calls) {
            echoed.add(Map.of("id", c.id(), "type", "function",
                    "function", Map.of("name", c.name(), "arguments", c.arguments())));
        }
        return Map.of("role", "assistant", "tool_calls", echoed);
    }

    /** One tool's result, in the turn shape Groq expects. */
    public static Map<String, Object> toolResultTurn(GroqReply.ToolCall call, String content) {
        return Map.of("role", "tool", "tool_call_id", call.id(), "name", call.name(), "content", content);
    }

    private Map<String, Object> post(Map<String, Object> body) {
        return client.post()
                .uri("/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    /**
     * Worth one more try: rate limited, a server error, or no reply at all.
     * Never a 4xx we caused (bad key, bad request): a retry would only fail again.
     */
    static boolean isTransient(RestClientException e) {
        if (e instanceof ResourceAccessException) return true;
        if (e instanceof RestClientResponseException r) {
            int status = r.getStatusCode().value();
            return status == 429 || status >= 500;
        }
        return false;
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Reads the answer, its tool calls and its token usage out of a chat-completions
     * response. Empty when there is neither text nor a tool call. Package-private so
     * a test can feed it a response map without an HTTP call.
     */
    static Optional<GroqReply> parse(Map<String, Object> response) {
        Map<?, ?> message = messageOf(response);
        if (message == null) return Optional.empty();
        Object content = message.get("content");
        String text = content == null ? "" : content.toString().trim();
        List<GroqReply.ToolCall> calls = toolCallsOf(message);
        if (text.isBlank() && calls.isEmpty()) return Optional.empty();

        int prompt = 0;
        int completion = 0;
        int cached = 0;
        if (response.get("usage") instanceof Map<?, ?> usage) {
            prompt = intOf(usage.get("prompt_tokens"));
            completion = intOf(usage.get("completion_tokens"));
            if (usage.get("prompt_tokens_details") instanceof Map<?, ?> details) {
                cached = intOf(details.get("cached_tokens"));
            }
        }
        return Optional.of(new GroqReply(text, prompt, completion, cached, calls));
    }

    /** Groq sends integers; anything else (missing, a string) counts as nothing. */
    private static int intOf(Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }

    private static Map<?, ?> messageOf(Map<String, Object> response) {
        if (response == null) return null;
        Object choices = response.get("choices");
        if (choices instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object message = first.get("message");
            if (message instanceof Map<?, ?> msg) return msg;
        }
        return null;
    }

    private static List<GroqReply.ToolCall> toolCallsOf(Map<?, ?> message) {
        Object raw = message.get("tool_calls");
        if (!(raw instanceof List<?> list)) return List.of();
        List<GroqReply.ToolCall> calls = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> call) || !(call.get("function") instanceof Map<?, ?> fn)) continue;
            Object id = call.get("id");
            Object name = fn.get("name");
            if (id == null || name == null) continue;
            Object args = fn.get("arguments");
            calls.add(new GroqReply.ToolCall(id.toString(), name.toString(), args == null ? "{}" : args.toString()));
        }
        return calls;
    }
}
