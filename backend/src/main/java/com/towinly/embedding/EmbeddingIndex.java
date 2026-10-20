package com.towinly.embedding;

import com.towinly.assistant.guide.GuideChunk;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;

/**
 * Keeps one embedding per profile and per help request, refreshed only when the
 * text behind it changes, and turns similarity into a small lift in the distance
 * order. Every method is a no-op without an embeddings key, and every lookup
 * reads as "no match" on a failure, so discovery can never break because of this.
 */
@Slf4j
@Component
public class EmbeddingIndex {

    /** A perfect match is worth this much closeness: 6 km with a strong match sorts like 3 km. */
    public static final double MATCH_WORTH_KM = 5.0;

    private final EmbeddingClient client;
    private final EmbeddingStore store;

    public EmbeddingIndex(EmbeddingClient client, EmbeddingStore store) {
        this.client = client;
        this.store = store;
    }

    public void refreshProfile(UUID userId, String text) {
        refreshOne(EmbeddingStore.Kind.PROFILES, userId, text);
    }

    public void refreshNeed(UUID needId, String text) {
        refreshOne(EmbeddingStore.Kind.NEEDS, needId, text);
    }

    private void refreshOne(EmbeddingStore.Kind kind, UUID id, String text) {
        if (!client.isConfigured()) return;
        try {
            String hash = GuideChunk.sha256(text);
            if (hash.equals(store.hashes(kind).get(id))) return;
            client.embedOne(text).ifPresent(v -> store.upsert(kind, id, hash, v));
        } catch (Exception e) {
            log.warn("Embedding refresh ({}, {}) failed: {}", kind, id, e.getMessage());
        }
    }

    /**
     * Embeds every text whose hash differs from the stored one, in batches, at most
     * {@code cap} of them. Returns how many were written. Used by the boot backfill.
     */
    public int refreshMany(EmbeddingStore.Kind kind, Map<UUID, String> texts, int cap) {
        if (!client.isConfigured() || texts.isEmpty()) return 0;
        Map<UUID, String> stored = store.hashes(kind);
        List<UUID> ids = new ArrayList<>();
        List<String> hashes = new ArrayList<>();
        List<String> pending = new ArrayList<>();
        for (Map.Entry<UUID, String> e : texts.entrySet()) {
            if (ids.size() >= cap) break;
            String hash = GuideChunk.sha256(e.getValue());
            if (hash.equals(stored.get(e.getKey()))) continue;
            ids.add(e.getKey());
            hashes.add(hash);
            pending.add(e.getValue());
        }
        int written = 0;
        for (int from = 0; from < ids.size(); from += EmbeddingClient.MAX_BATCH) {
            int to = Math.min(from + EmbeddingClient.MAX_BATCH, ids.size());
            Optional<List<float[]>> vectors = client.embed(pending.subList(from, to));
            if (vectors.isEmpty()) {
                log.warn("Embedding backfill ({}): a batch failed; stopping this pass", kind);
                break;
            }
            for (int i = from; i < to; i++) {
                store.upsert(kind, ids.get(i), hashes.get(i), vectors.get().get(i - from));
                written++;
            }
        }
        return written;
    }

    /** What an elder is looking for: their newest open request, or failing that, themselves. */
    public Optional<float[]> queryVectorForElder(UUID elderId) {
        if (!client.isConfigured()) return Optional.empty();
        try {
            Optional<float[]> need = store.latestOpenNeedVector(elderId);
            return need.isPresent() ? need : store.vector(EmbeddingStore.Kind.PROFILES, elderId);
        } catch (Exception e) {
            log.warn("Embedding query for {} failed: {}", elderId, e.getMessage());
            return Optional.empty();
        }
    }

    public Optional<float[]> profileVector(UUID userId) {
        if (!client.isConfigured()) return Optional.empty();
        try {
            return store.vector(EmbeddingStore.Kind.PROFILES, userId);
        } catch (Exception e) {
            log.warn("Embedding read for {} failed: {}", userId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Similarity per id, or an empty map when off or on any failure (then nothing moves). */
    public Map<UUID, Double> similarity(EmbeddingStore.Kind kind, float[] query, Collection<UUID> ids) {
        if (!client.isConfigured() || ids.isEmpty()) return Map.of();
        try {
            return store.similarity(kind, query, ids);
        } catch (Exception e) {
            log.warn("Embedding similarity ({}) failed: {}", kind, e.getMessage());
            return Map.of();
        }
    }

    /** Distance minus the lift; a missing similarity lifts nothing. */
    public static double rankKey(double distanceKm, Double similarity) {
        return distanceKm - MATCH_WORTH_KM * (similarity == null ? 0.0 : similarity);
    }

    /**
     * Re-orders a distance-sorted list by {@link #rankKey}. Stable, so two equal keys
     * keep their distance order. The elements and their distances are unchanged.
     */
    public static <T> List<T> byMatch(List<T> byDistance, Map<UUID, Double> similarity,
                                      Function<T, UUID> idOf, ToDoubleFunction<T> distanceOf) {
        if (similarity.isEmpty()) return byDistance;
        List<T> ordered = new ArrayList<>(byDistance);
        ordered.sort(Comparator.comparingDouble(t -> rankKey(distanceOf.applyAsDouble(t), similarity.get(idOf.apply(t)))));
        return ordered;
    }
}
