package com.towinly.assistant.guide;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the migration and the nearest-neighbour query on a real Postgres with
 * pgvector. Gated like the other DB tests:
 * <pre>
 *   TOWINLY_DB_TESTS=true SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=GuideChunkStoreDbTest
 * </pre>
 * The local Postgres must have pgvector installed (`CREATE EXTENSION vector` must work).
 */
@SpringBootTest(properties = "embeddings.api-key=")
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class GuideChunkStoreDbTest {

    @Autowired private GuideChunkStore store;
    @Autowired private JdbcTemplate jdbc;

    private static float[] unit(int hot) {
        float[] v = new float[1536];
        v[hot] = 1f;
        return v;
    }

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM assistant_guide_chunks");
    }

    @Test
    void nearestReturnsTheClosestChunkFirst_andDeleteKeepsOnlyTheNamedHashes() {
        GuideChunk a = new GuideChunk("start", "what", "Start / What", List.of("elder"), "A", GuideChunk.sha256("A"));
        GuideChunk b = new GuideChunk("start", "how", "Start / How", List.of("helper"), "B", GuideChunk.sha256("B"));
        store.insert(a, unit(0));
        store.insert(b, unit(1));
        assertThat(store.hashes()).containsExactlyInAnyOrder(a.hash(), b.hash());

        float[] nearA = unit(0);
        nearA[1] = 0.2f;
        assertThat(store.nearest(nearA, 2)).extracting(GuideChunk::text).containsExactly("A", "B");
        assertThat(store.nearest(nearA, 1).get(0).roles()).containsExactly("elder");

        assertThat(store.deleteAllExcept(Set.of(b.hash()))).isEqualTo(1);
        assertThat(store.hashes()).containsExactly(b.hash());
    }
}
