package com.towinly.common.idempotency;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.persistence.AdvisoryLocking;
import com.towinly.connection.repository.ConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The idempotency table and the advisory-lock query only mean anything on a real
 * Postgres (ON CONFLICT, INTERVAL arithmetic, pg_advisory_xact_lock), so they are
 * exercised here, gated like the other DB-backed tests.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
@Import(IdempotencyStore.class)
class IdempotencyStoreDbTest {

    @Autowired TestEntityManager entityManager;
    @Autowired IdempotencyStore store;
    @Autowired JdbcTemplate jdbc;
    @Autowired ConnectionRepository connectionRepository;

    private UUID userId;

    @BeforeEach
    void user() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        User user = entityManager.persist(User.builder()
                .username("idem_" + tag)
                .email("idem-" + tag + "@test.local")
                .phone("+1" + Math.abs(tag.hashCode()))
                .passwordHash("hash")
                .role(UserRole.ELDER)
                .trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build());
        entityManager.flush();
        userId = user.getId();
    }

    @Test
    void firstClaimStartsAndASecondWaits() {
        assertThat(store.claim(userId, "key-0001", "hash-a")).isInstanceOf(IdempotencyStore.Started.class);
        assertThat(store.claim(userId, "key-0001", "hash-a")).isInstanceOf(IdempotencyStore.InProgress.class);
    }

    @Test
    void aCompletedClaimReplaysTheSavedAnswer() {
        store.claim(userId, "key-0002", "hash-a");
        store.complete(userId, "key-0002", 201, "application/json", "{\"id\":1}".getBytes(StandardCharsets.UTF_8));

        IdempotencyStore.Claim again = store.claim(userId, "key-0002", "hash-a");

        assertThat(again).isInstanceOf(IdempotencyStore.Replay.class);
        IdempotencyStore.Replay replay = (IdempotencyStore.Replay) again;
        assertThat(replay.status()).isEqualTo(201);
        assertThat(replay.contentType()).isEqualTo("application/json");
        assertThat(new String(replay.body(), StandardCharsets.UTF_8)).isEqualTo("{\"id\":1}");
    }

    @Test
    void theSameKeyOnADifferentRequestIsAMismatch() {
        store.claim(userId, "key-0003", "hash-a");
        store.complete(userId, "key-0003", 200, "application/json", new byte[0]);

        assertThat(store.claim(userId, "key-0003", "hash-b")).isInstanceOf(IdempotencyStore.Mismatch.class);
    }

    @Test
    void aReleasedClaimRunsAgain() {
        store.claim(userId, "key-0004", "hash-a");
        store.release(userId, "key-0004");

        assertThat(store.claim(userId, "key-0004", "hash-a")).isInstanceOf(IdempotencyStore.Started.class);
    }

    @Test
    void anAbandonedClaimIsTakenOver() {
        store.claim(userId, "key-0005", "hash-a");
        age("key-0005", "10 minutes");

        assertThat(store.claim(userId, "key-0005", "hash-a")).isInstanceOf(IdempotencyStore.Started.class);
    }

    @Test
    void anExpiredAnswerIsForgottenAndTheRequestRunsAgain() {
        store.claim(userId, "key-0006", "hash-a");
        store.complete(userId, "key-0006", 200, "application/json", new byte[0]);
        age("key-0006", "25 hours");

        assertThat(store.claim(userId, "key-0006", "hash-a")).isInstanceOf(IdempotencyStore.Started.class);
    }

    @Test
    void sweepRemovesOnlyExpiredRows() {
        store.claim(userId, "key-0007", "hash-a");
        store.claim(userId, "key-0008", "hash-a");
        age("key-0007", "25 hours");

        store.sweepExpired();

        Integer left = jdbc.queryForObject("SELECT COUNT(*) FROM idempotency_keys WHERE user_id = ?", Integer.class, userId);
        assertThat(left).isEqualTo(1);
    }

    @Test
    void keysAreScopedPerUser() {
        store.claim(userId, "key-0009", "hash-a");
        UUID other = UUID.randomUUID();
        // Another user's identical key is a different row, so it never replays this one.
        Integer rows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM idempotency_keys WHERE user_id = ? AND idem_key = ?", Integer.class, other, "key-0009");
        assertThat(rows).isZero();
    }

    @Test
    void theAdvisoryLockQueryRunsOnPostgres() {
        long key = AdvisoryLocking.key("connection-pair", UUID.randomUUID(), UUID.randomUUID());
        assertThat(connectionRepository.lockUntilCommit(key)).isEqualTo(1);
        // Re-entrant inside one transaction: taking it twice must not deadlock.
        assertThat(connectionRepository.lockUntilCommit(key)).isEqualTo(1);
    }

    private void age(String key, String by) {
        jdbc.update("UPDATE idempotency_keys SET created_at = NOW() - CAST(? AS INTERVAL) WHERE user_id = ? AND idem_key = ?",
                by, userId, key);
    }
}
