package com.towinly.embedding;

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
 * Turns text into vectors through an OpenAI-compatible {@code /embeddings}
 * endpoint (OpenAI, Gemini and Mistral all expose this shape, so the provider is
 * a configuration change). Built like {@link com.towinly.assistant.service.GroqClient}:
 * bounded timeouts, and every failure is logged and swallowed into an empty
 * Optional, because a missing vector must never stop an answer or a boot.
 *
 * <p>A blank key means off: {@link #isConfigured()} is false and every call is
 * empty, so the indexer and the retriever quietly do nothing.
 */
@Slf4j
@Component
public class EmbeddingClient {

    /** OpenAI accepts 2,048 inputs per call; a hundred keeps each request small. */
    public static final int MAX_BATCH = 100;

    private final RestClient client;
    private final String apiKey;
    private final String model;
    private final int dimensions;
    private final boolean enabled;

    public EmbeddingClient(
            @Value("${embeddings.base-url:https://api.openai.com/v1}") String baseUrl,
            @Value("${embeddings.api-key:}") String apiKey,
            @Value("${embeddings.model:text-embedding-3-small}") String model,
            @Value("${embeddings.dimensions:1536}") int dimensions,
            @Value("${embeddings.enabled:true}") boolean enabled) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        // A question's embedding sits on the answer's path, so it must be quick; a
        // batch of a hundred guide chunks at boot takes a few seconds.
        factory.setReadTimeout(15000);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.apiKey = apiKey;
        this.model = model;
        this.dimensions = dimensions;
        this.enabled = enabled;
    }

    /** True when a key is present and embeddings are switched on. */
    public boolean isConfigured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }

    public int dimensions() {
        return dimensions;
    }

    /** One vector per text, in order. Empty on any failure or when not configured. */
    public Optional<List<float[]>> embed(List<String> texts) {
        if (!isConfigured() || texts == null || texts.isEmpty()) return Optional.empty();
        if (texts.size() > MAX_BATCH) {
            log.warn("Embeddings: batch of {} exceeds {}", texts.size(), MAX_BATCH);
            return Optional.empty();
        }
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("model", model);
            body.put("input", texts);
            body.put("dimensions", dimensions);
            Map<String, Object> response = client.post()
                    .uri("/embeddings")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            return parse(response, texts.size(), dimensions);
        } catch (Exception e) {
            log.warn("Embeddings call failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** One text, one vector. */
    public Optional<float[]> embedOne(String text) {
        return embed(List.of(text)).map(v -> v.get(0));
    }

    /**
     * Reads {@code data[].embedding} ordered by {@code data[].index}. Empty unless
     * exactly {@code expected} vectors of {@code dimensions} numbers came back, so a
     * short or reshaped reply can never be written to the table.
     */
    static Optional<List<float[]>> parse(Map<String, Object> response, int expected, int dimensions) {
        if (response == null || !(response.get("data") instanceof List<?> data) || data.size() != expected) {
            return Optional.empty();
        }
        float[][] ordered = new float[expected][];
        for (Object item : data) {
            if (!(item instanceof Map<?, ?> row)) return Optional.empty();
            Object index = row.get("index");
            Object embedding = row.get("embedding");
            if (!(index instanceof Number i) || !(embedding instanceof List<?> values)) return Optional.empty();
            int at = i.intValue();
            if (at < 0 || at >= expected || values.size() != dimensions) return Optional.empty();
            float[] vector = new float[dimensions];
            for (int k = 0; k < dimensions; k++) {
                if (!(values.get(k) instanceof Number n)) return Optional.empty();
                vector[k] = n.floatValue();
            }
            ordered[at] = vector;
        }
        List<float[]> out = new ArrayList<>(expected);
        for (float[] v : ordered) {
            if (v == null) return Optional.empty();
            out.add(v);
        }
        return Optional.of(out);
    }

    /** The reverse of {@link #toVectorLiteral}: what {@code embedding::text} gives back. */
    public static float[] fromVectorLiteral(String literal) {
        String inner = literal.trim();
        inner = inner.substring(1, inner.length() - 1);
        if (inner.isBlank()) return new float[0];
        String[] parts = inner.split(",");
        float[] v = new float[parts.length];
        for (int i = 0; i < parts.length; i++) v[i] = Float.parseFloat(parts[i].trim());
        return v;
    }

    /** The literal pgvector reads: {@code [0.1,0.2,...]}. */
    public static String toVectorLiteral(float[] vector) {
        StringBuilder sb = new StringBuilder(vector.length * 10).append('[');
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(vector[i]);
        }
        return sb.append(']').toString();
    }
}
