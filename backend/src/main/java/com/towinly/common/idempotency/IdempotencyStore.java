package com.towinly.common.idempotency;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * The idempotency_keys table (V60). Every call runs in its own short transaction,
 * outside the request's business transaction, so a claimed key is visible to a
 * concurrent retry before the first attempt has finished.
 *
 * Timestamps are compared with the database's NOW() rather than this server's
 * clock, so two backend instances can never disagree about whether a row is stale.
 */
@Component
@RequiredArgsConstructor
public class IdempotencyStore {

    /** A claimed key older than this whose request never finished is taken over. */
    static final String ABANDONED_AFTER = "2 minutes";
    /** How long a finished answer stays replayable. */
    static final String KEPT_FOR = "24 hours";

    private final JdbcTemplate jdbc;

    /** What the first attempt left behind for this user and key. */
    public sealed interface Claim permits Started, InProgress, Mismatch, Replay {}
    /** No earlier attempt: the caller now owns the key and must run the request. */
    public record Started() implements Claim {}
    /** An earlier attempt is still running. */
    public record InProgress() implements Claim {}
    /** The key was already used for a different request. */
    public record Mismatch() implements Claim {}
    /** An earlier attempt succeeded: send this answer back again. */
    public record Replay(int status, String contentType, byte[] body) implements Claim {}

    private record Row(String requestHash, String state, Integer status, String contentType,
                       byte[] body, boolean abandoned, boolean expired) {}

    public Claim claim(UUID userId, String key, String requestHash) {
        // Two passes at most: the second covers a row that expired or was released
        // between our insert and our read.
        for (int attempt = 0; attempt < 2; attempt++) {
            if (tryInsert(userId, key, requestHash)) {
                return new Started();
            }
            Row row = read(userId, key);
            if (row == null) {
                continue;
            }
            if (row.expired()) {
                jdbc.update("DELETE FROM idempotency_keys WHERE user_id = ? AND idem_key = ? "
                        + "AND created_at < NOW() - CAST(? AS INTERVAL)", userId, key, KEPT_FOR);
                continue;
            }
            if (!row.requestHash().equals(requestHash)) {
                return new Mismatch();
            }
            if ("COMPLETED".equals(row.state())) {
                return new Replay(row.status(), row.contentType(), row.body());
            }
            if (row.abandoned() && takeOver(userId, key)) {
                return new Started();
            }
            return new InProgress();
        }
        return new InProgress();
    }

    /** Saves the first attempt's successful answer so a retry gets the same one. */
    public void complete(UUID userId, String key, int status, String contentType, byte[] body) {
        jdbc.update("UPDATE idempotency_keys SET state = 'COMPLETED', response_status = ?, "
                + "content_type = ?, response_body = ? WHERE user_id = ? AND idem_key = ?",
                status, contentType, body, userId, key);
    }

    /** The attempt failed: forget the key so a retry runs the request again. */
    public void release(UUID userId, String key) {
        jdbc.update("DELETE FROM idempotency_keys WHERE user_id = ? AND idem_key = ? "
                + "AND state = 'IN_PROGRESS'", userId, key);
    }

    /** Hourly: drop answers nobody can replay any more. */
    @Scheduled(fixedDelay = 60 * 60 * 1000L, initialDelay = 5 * 60 * 1000L)
    public void sweepExpired() {
        jdbc.update("DELETE FROM idempotency_keys WHERE created_at < NOW() - CAST(? AS INTERVAL)", KEPT_FOR);
    }

    private boolean tryInsert(UUID userId, String key, String requestHash) {
        return jdbc.update("INSERT INTO idempotency_keys (user_id, idem_key, request_hash, state) "
                + "VALUES (?, ?, ?, 'IN_PROGRESS') ON CONFLICT DO NOTHING",
                userId, key, requestHash) == 1;
    }

    private boolean takeOver(UUID userId, String key) {
        return jdbc.update("UPDATE idempotency_keys SET created_at = NOW() WHERE user_id = ? AND idem_key = ? "
                + "AND state = 'IN_PROGRESS' AND created_at < NOW() - CAST(? AS INTERVAL)",
                userId, key, ABANDONED_AFTER) == 1;
    }

    private Row read(UUID userId, String key) {
        List<Row> rows = jdbc.query(
                "SELECT request_hash, state, response_status, content_type, response_body, "
                + "created_at < NOW() - CAST(? AS INTERVAL) AS abandoned, "
                + "created_at < NOW() - CAST(? AS INTERVAL) AS expired "
                + "FROM idempotency_keys WHERE user_id = ? AND idem_key = ?",
                (rs, i) -> new Row(
                        rs.getString("request_hash"),
                        rs.getString("state"),
                        (Integer) rs.getObject("response_status"),
                        rs.getString("content_type"),
                        rs.getBytes("response_body"),
                        rs.getBoolean("abandoned"),
                        rs.getBoolean("expired")),
                ABANDONED_AFTER, KEPT_FOR, userId, key);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
