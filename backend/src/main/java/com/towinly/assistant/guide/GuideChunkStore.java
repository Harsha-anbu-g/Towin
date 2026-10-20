package com.towinly.assistant.guide;

import com.towinly.embedding.EmbeddingClient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The guide chunks table. Plain SQL through JdbcTemplate, because the
 * {@code vector} column has no JPA mapping and needs none: four statements
 * cover everything the indexer and the retriever do.
 */
@Component
public class GuideChunkStore {

    private final JdbcTemplate jdbc;

    public GuideChunkStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Every content hash in the table. */
    public Set<String> hashes() {
        return new HashSet<>(jdbc.queryForList("SELECT content_hash FROM assistant_guide_chunks", String.class));
    }

    public void insert(GuideChunk chunk, float[] embedding) {
        jdbc.update("INSERT INTO assistant_guide_chunks (part, chapter, heading, roles, content, content_hash, embedding) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?::vector)",
                chunk.part(), chunk.chapter(), chunk.heading(), String.join(",", chunk.roles()),
                chunk.text(), chunk.hash(), EmbeddingClient.toVectorLiteral(embedding));
    }

    /** Removes rows whose hash is no longer in the corpus. Returns how many went. */
    public int deleteAllExcept(Collection<String> keep) {
        if (keep.isEmpty()) return jdbc.update("DELETE FROM assistant_guide_chunks");
        String placeholders = String.join(",", Collections.nCopies(keep.size(), "?"));
        return jdbc.update("DELETE FROM assistant_guide_chunks WHERE content_hash NOT IN (" + placeholders + ")",
                keep.toArray());
    }

    /** The chunks nearest to the query by cosine distance, nearest first. */
    public List<GuideChunk> nearest(float[] query, int limit) {
        return jdbc.query(
                "SELECT part, chapter, heading, roles, content, content_hash FROM assistant_guide_chunks "
                        + "ORDER BY embedding <=> ?::vector LIMIT ?",
                (rs, i) -> new GuideChunk(rs.getString("part"), rs.getString("chapter"), rs.getString("heading"),
                        List.of(rs.getString("roles").split(",")), rs.getString("content"), rs.getString("content_hash")),
                EmbeddingClient.toVectorLiteral(query), limit);
    }
}
