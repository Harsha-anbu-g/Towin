package com.towinly.embedding;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** What the client reads from an embeddings reply, and how a vector is written for pgvector. */
class EmbeddingClientParseTest {

    @Test
    void readsOneVectorPerInput_inIndexOrder() {
        Map<String, Object> response = Map.of("data", List.of(
                Map.of("index", 1, "embedding", List.of(0.5, 0.25)),
                Map.of("index", 0, "embedding", List.of(0.1, 0.2))));

        Optional<List<float[]>> vectors = EmbeddingClient.parse(response, 2, 2);

        assertThat(vectors).isPresent();
        assertThat(vectors.get().get(0)).containsExactly(0.1f, 0.2f);
        assertThat(vectors.get().get(1)).containsExactly(0.5f, 0.25f);
    }

    @Test
    void theWrongCountOrDimension_isEmpty() {
        Map<String, Object> one = Map.of("data", List.of(Map.of("index", 0, "embedding", List.of(0.1, 0.2))));

        assertThat(EmbeddingClient.parse(one, 2, 2)).as("fewer vectors than inputs").isEmpty();
        assertThat(EmbeddingClient.parse(one, 1, 3)).as("wrong dimension").isEmpty();
        assertThat(EmbeddingClient.parse(Map.of(), 1, 2)).isEmpty();
        assertThat(EmbeddingClient.parse(null, 1, 2)).isEmpty();
    }

    @Test
    void vectorLiteral_isWhatPgvectorReads() {
        assertThat(EmbeddingClient.toVectorLiteral(new float[] {0.1f, -2f, 3.25f})).isEqualTo("[0.1,-2.0,3.25]");
    }

    @Test
    void notConfigured_withoutAKey() {
        EmbeddingClient off = new EmbeddingClient("https://api.openai.com/v1", "", "text-embedding-3-small", 1536, true);
        EmbeddingClient disabled = new EmbeddingClient("https://api.openai.com/v1", "k", "text-embedding-3-small", 1536, false);

        assertThat(off.isConfigured()).isFalse();
        assertThat(disabled.isConfigured()).isFalse();
        assertThat(off.embed(List.of("hello"))).isEmpty();
    }
    @Test
    void vectorLiteral_roundTrips() {
        float[] v = {0.1f, -2f, 3.25f};
        assertThat(EmbeddingClient.fromVectorLiteral(EmbeddingClient.toVectorLiteral(v))).containsExactly(v);
        assertThat(EmbeddingClient.fromVectorLiteral("[1,2]")).containsExactly(1f, 2f);
    }
}
