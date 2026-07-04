package com.towin.assistant.service;

import com.towin.assistant.dto.ChatMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Thin wrapper over Groq's OpenAI-compatible Chat Completions API. Built like
 * {@link com.towin.geocoding.GeocodingService}: a RestClient with bounded
 * timeouts, and every failure is swallowed into an empty Optional and logged —
 * the help assistant must never surface a stack trace or hold up a reply.
 *
 * The API key lives only in configuration (env var); it is attached here on the
 * server and never reaches the browser.
 */
@Slf4j
@Component
public class GroqClient {

    private final RestClient client;
    private final String apiKey;
    private final String model;
    private final boolean enabled;
    private final String reasoningEffort;

    public GroqClient(
            @Value("${groq.base-url:https://api.groq.com/openai/v1}") String baseUrl,
            @Value("${groq.api-key:}") String apiKey,
            @Value("${groq.model:openai/gpt-oss-20b}") String model,
            @Value("${groq.enabled:true}") boolean enabled,
            @Value("${groq.reasoning-effort:low}") String reasoningEffort) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(30000);
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
     * text. Returns empty on any misconfiguration, timeout, or API error so the
     * caller can fall back to a friendly message.
     */
    public Optional<String> complete(String systemPrompt, List<ChatMessage> conversation) {
        if (!isConfigured()) {
            log.warn("Ask AI called but Groq is not configured (missing key or disabled).");
            return Optional.empty();
        }
        try {
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", systemPrompt));
            for (ChatMessage m : conversation) {
                messages.add(Map.of("role", m.getRole(), "content", m.getContent()));
            }

            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("messages", messages);
            body.put("temperature", 0.3);
            body.put("max_tokens", 700);
            // Reasoning models (gpt-oss) otherwise spend the whole token budget
            // "thinking" and truncate the actual answer. "low" keeps replies direct.
            // Blank omits it, for non-reasoning models that reject the field.
            if (reasoningEffort != null && !reasoningEffort.isBlank()) {
                body.put("reasoning_effort", reasoningEffort);
            }

            Map<String, Object> response = client.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            String text = extractContent(response);
            return (text == null || text.isBlank()) ? Optional.empty() : Optional.of(text.trim());
        } catch (Exception e) {
            log.warn("Ask AI (Groq) call failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> response) {
        if (response == null) return null;
        Object choices = response.get("choices");
        if (choices instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object message = ((Map<String, Object>) first).get("message");
            if (message instanceof Map<?, ?> msg) {
                Object content = ((Map<String, Object>) msg).get("content");
                if (content != null) return content.toString();
            }
        }
        return null;
    }
}
