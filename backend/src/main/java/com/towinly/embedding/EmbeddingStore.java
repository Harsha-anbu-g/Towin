package com.towinly.embedding;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** The two embedding tables, through plain SQL. One shape for profiles and requests. */
@Component
public class EmbeddingStore {

    public enum Kind {
        PROFILES("profile_embeddings", "user_id"),
        NEEDS("need_embeddings", "need_id");

        final String table;
        final String idColumn;

        Kind(String table, String idColumn) {
            this.table = table;
            this.idColumn = idColumn;
        }
    }

    private final JdbcTemplate jdbc;

    public EmbeddingStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Every stored id with its content hash. */
    public Map<UUID, String> hashes(Kind kind) {
        Map<UUID, String> out = new HashMap<>();
        jdbc.query("SELECT " + kind.idColumn + ", content_hash FROM " + kind.table,
                rs -> { out.put(UUID.fromString(rs.getString(1)), rs.getString(2)); });
        return out;
    }

    public void upsert(Kind kind, UUID id, String hash, float[] embedding) {
        jdbc.update("INSERT INTO " + kind.table + " (" + kind.idColumn + ", content_hash, embedding, updated_at) "
                        + "VALUES (?, ?, ?::vector, now()) ON CONFLICT (" + kind.idColumn + ") DO UPDATE SET "
                        + "content_hash = EXCLUDED.content_hash, embedding = EXCLUDED.embedding, updated_at = now()",
                id, hash, EmbeddingClient.toVectorLiteral(embedding));
    }

    public Optional<float[]> vector(Kind kind, UUID id) {
        List<String> rows = jdbc.queryForList(
                "SELECT embedding::text FROM " + kind.table + " WHERE " + kind.idColumn + " = ?", String.class, id);
        return rows.isEmpty() ? Optional.empty() : Optional.of(EmbeddingClient.fromVectorLiteral(rows.get(0)));
    }

    /** The embedding of the elder's newest open request, if it has one. */
    public Optional<float[]> latestOpenNeedVector(UUID elderId) {
        List<String> rows = jdbc.queryForList(
                "SELECT ne.embedding::text FROM need_embeddings ne JOIN needs n ON n.id = ne.need_id "
                        + "WHERE n.elder_id = ? AND n.status = 'OPEN' ORDER BY n.created_at DESC LIMIT 1",
                String.class, elderId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(EmbeddingClient.fromVectorLiteral(rows.get(0)));
    }

    /** Cosine similarity of the query to each listed id; ids without a row are absent. */
    public Map<UUID, Double> similarity(Kind kind, float[] query, Collection<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        Object[] args = new Object[ids.size() + 1];
        args[0] = EmbeddingClient.toVectorLiteral(query);
        int i = 1;
        for (UUID id : ids) args[i++] = id;
        Map<UUID, Double> out = new HashMap<>();
        jdbc.query("SELECT " + kind.idColumn + ", 1 - (embedding <=> ?::vector) AS sim FROM " + kind.table
                        + " WHERE " + kind.idColumn + " IN (" + placeholders + ")",
                rs -> { out.put(UUID.fromString(rs.getString(1)), rs.getDouble(2)); }, args);
        return out;
    }
}
