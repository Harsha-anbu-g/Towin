package com.towinly.embedding;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Upsert, read back, and similarity on a real Postgres with pgvector. Gated like
 * the other DB tests (TOWINLY_DB_TESTS=true, a towin_test database with pgvector).
 */
@SpringBootTest(properties = "embeddings.api-key=")
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class EmbeddingStoreDbTest {

    @Autowired private EmbeddingStore store;
    @Autowired private JdbcTemplate jdbc;

    private UUID user;

    private static float[] unit(int hot) {
        float[] v = new float[1536];
        v[hot] = 1f;
        return v;
    }

    @BeforeEach
    void aUserToHangTheRowOn() {
        user = UUID.randomUUID();
        String tag = user.toString().substring(0, 8);
        jdbc.update("INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, 'x', 'ELDER'::user_role)",
                user, "emb_test_" + tag, "emb_test_" + tag + "@example.test");
    }

    @AfterEach
    void tidy() {
        jdbc.update("DELETE FROM users WHERE id = ?", user);
    }

    @Test
    void upsertReadBackAndSimilarity() {
        store.upsert(EmbeddingStore.Kind.PROFILES, user, "h1", unit(0));
        assertThat(store.hashes(EmbeddingStore.Kind.PROFILES)).containsEntry(user, "h1");
        assertThat(store.vector(EmbeddingStore.Kind.PROFILES, user)).isPresent();

        store.upsert(EmbeddingStore.Kind.PROFILES, user, "h2", unit(1));
        assertThat(store.hashes(EmbeddingStore.Kind.PROFILES)).containsEntry(user, "h2");

        assertThat(store.similarity(EmbeddingStore.Kind.PROFILES, unit(1), List.of(user)).get(user))
                .isCloseTo(1.0, within(0.001));
        assertThat(store.similarity(EmbeddingStore.Kind.PROFILES, unit(0), List.of(user)).get(user))
                .isCloseTo(0.0, within(0.001));
    }
}
