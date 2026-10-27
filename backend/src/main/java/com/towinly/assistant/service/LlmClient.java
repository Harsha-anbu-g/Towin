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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Thin wrapper over an OpenAI-compatible Chat Completions API: OpenAI itself by
 * default (gpt-6-luna), any vendor that copies the shape through llm.base-url;
 * Groq's free tier served it until 2026-10-27, when its 8,000 tokens a minute
 * could no longer carry a 6,500-token question. Built like
 * {@link com.towinly.geocoding.GeocodingService}: a RestClient with bounded
 * timeouts, and every failure is swallowed into an empty Optional and logged —
 * the help assistant must never surface a stack trace or hold up a reply.
 *
 * The API key lives only in configuration (env var); it is attached here on the
 * server and never reaches the browser.
 */
@Slf4j
@Component
public class LlmClient {

    private static final long RETRY_DELAY_MS = 700;

    private final RestClient client;
    private final String apiKey;
    private final String model;
    private final boolean enabled;
    private final String reasoningEffort;

    public LlmClient(
            @Value("${llm.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${llm.api-key:}") String apiKey,
            @Value("${llm.model:gpt-6-luna}") String model,
            @Value("${llm.enabled:true}") boolean enabled,
            @Value("${llm.reasoning-effort:none}") String reasoningEffort) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        // A tool round is two calls, and only the first may retry: 9 + 0.7 + 9, then
        // 9 more, stays under the iPhone app's 30 s request timeout. An answer with
        // reasoning off normally takes a few seconds.
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
     * Sends the system prompt + conversation to the model and returns the assistant's
     * text with the token usage the API reports for the call. No tools. Returns empty
     * on any misconfiguration, timeout, or API error so the caller can fall back to
     * a friendly message.
     */
    public Optional<LlmReply> complete(String systemPrompt, List<ChatMessage> conversation) {
        return complete(systemPrompt, toMessages(conversation), null, null, true);
    }

    /**
     * The general call. {@code messages} are the turns after the system prompt, in
     * the API's own shape (see {@link #toMessages}, {@link #toolCallTurn} and
     * {@link #toolResultTurn}). {@code tools} may be null; {@code toolChoice} is
     * "auto" or "none" when tools are given. {@code retryOnce} allows one quiet
     * retry on a busy moment; the second call of a tool round must not retry, or
     * the whole answer could outrun the app's 30 s timeout.
     */
    public Optional<LlmReply> complete(String systemPrompt, List<Map<String, Object>> messages,
                                        List<Map<String, Object>> tools, String toolChoice, boolean retryOnce) {
        if (!isConfigured()) {
            log.warn("Ask AI called but no model is configured (missing key or disabled).");
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
            // The current name; reasoning models reject the old max_tokens.
            body.put("max_completion_tokens", 1000);
            // gpt-6-luna calls tools on Chat Completions only with reasoning off
            // ("none"), which is also the quickest and cheapest answer. A higher
            // setting spends tokens thinking first. Blank omits the field, for a
            // model that rejects it.
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
                // A busy moment at the vendor (rate limit, 5xx, a dropped connection) usually
                // clears within a second. One quiet retry turns most of those into an
                // answer instead of "Sorry, I can't answer just now".
                log.info("Ask AI (model) transient failure, retrying once: {}", first.getMessage());
                sleep(RETRY_DELAY_MS);
                response = post(body);
            }

            return parse(response);
        } catch (RestClientResponseException e) {
            // The error body names the field it rejected; without it a 400 is a guess.
            log.warn("Ask AI (model) call failed: {} {}", e.getStatusCode().value(),
                    abbreviate(e.getResponseBodyAsString()));
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Ask AI (model) call failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** The conversation as Chat Completions message maps: role and content, nothing else. */
    public static List<Map<String, Object>> toMessages(List<ChatMessage> conversation) {
        List<Map<String, Object>> messages = new ArrayList<>();
        for (ChatMessage m : conversation) {
            messages.add(Map.of("role", m.getRole(), "content", m.getContent()));
        }
        return messages;
    }

    /**
     * The assistant turn that carried the tool calls, echoed back before their
     * results, the way the Chat Completions API documents it: the model's message
     * whole. {@code content} is always a string (the API returns null when the
     * model only called a tool; an empty string is accepted everywhere, a missing
     * one was a 400 at Groq), and a vendor that returns {@code reasoning} on the
     * turn (Groq's gpt-oss did) gets it back. Sending only the tool calls was the
     * live failure of 2026-10-25: every tool question ended in the fallback sentence.
     */
    public static Map<String, Object> toolCallTurn(LlmReply first) {
        List<Map<String, Object>> echoed = new ArrayList<>();
        for (LlmReply.ToolCall c : first.toolCalls()) {
            echoed.add(Map.of("id", c.id(), "type", "function",
                    "function", Map.of("name", c.name(), "arguments", c.arguments())));
        }
        Map<String, Object> turn = new LinkedHashMap<>();
        turn.put("role", "assistant");
        turn.put("content", first.text() == null ? "" : first.text());
        if (first.reasoning() != null) turn.put("reasoning", first.reasoning());
        turn.put("tool_calls", echoed);
        return turn;
    }

    /** One tool's result, in the turn shape the API expects: the call it answers, and the text. */
    public static Map<String, Object> toolResultTurn(LlmReply.ToolCall call, String content) {
        return Map.of("role", "tool", "tool_call_id", call.id(), "content", content);
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
    static Optional<LlmReply> parse(Map<String, Object> response) {
        Map<?, ?> message = messageOf(response);
        if (message == null) return Optional.empty();
        Object content = message.get("content");
        String text = content == null ? "" : content.toString().trim();
        List<LlmReply.ToolCall> calls = toolCallsOf(message);
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
        Object reasoning = message.get("reasoning");
        return Optional.of(new LlmReply(text, prompt, completion, cached, calls,
                reasoning == null ? null : reasoning.toString()));
    }

    /** The API sends integers; anything else (missing, a string) counts as nothing. */
    private static int intOf(Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }

    /** Enough of an error body to read the reason, never a whole page of it. */
    private static String abbreviate(String body) {
        if (body == null) return "";
        return body.length() <= 600 ? body : body.substring(0, 600) + "...";
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

    private static List<LlmReply.ToolCall> toolCallsOf(Map<?, ?> message) {
        Object raw = message.get("tool_calls");
        if (!(raw instanceof List<?> list)) return List.of();
        List<LlmReply.ToolCall> calls = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> call) || !(call.get("function") instanceof Map<?, ?> fn)) continue;
            Object id = call.get("id");
            Object name = fn.get("name");
            if (id == null || name == null) continue;
            Object args = fn.get("arguments");
            calls.add(new LlmReply.ToolCall(id.toString(), name.toString(), args == null ? "{}" : args.toString()));
        }
        return calls;
    }
}
