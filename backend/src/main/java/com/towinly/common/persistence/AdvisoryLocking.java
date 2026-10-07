package com.towinly.common.persistence;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.UUID;

/**
 * Serialises "check, then insert" sections that a unique constraint cannot cover.
 *
 * Two taps a moment apart (or two devices) both read "no row yet" and both insert:
 * two connection requests between the same pair in opposite seats, two reviews of
 * one finished need, two helpers accepted on one need. Taking a Postgres
 * transaction-level advisory lock on the same key first makes the second caller
 * wait until the first commits, so its own check then sees the first one's row.
 *
 * Mixed into a repository so services keep their constructors. Must be called
 * inside a @Transactional method: the lock is released at commit or rollback.
 */
public interface AdvisoryLocking {

    @Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(:key)) AS locked", nativeQuery = true)
    Integer lockUntilCommit(@Param("key") long key);

    /**
     * A 64-bit lock key for a scope and some ids. The ids are sorted, so the pair
     * (A, B) and the pair (B, A) take the same lock.
     */
    static long key(String scope, UUID... ids) {
        String[] parts = Arrays.stream(ids).map(UUID::toString).sorted().toArray(String[]::new);
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(scope.getBytes(StandardCharsets.UTF_8));
            for (String part : parts) {
                sha.update((byte) '|');
                sha.update(part.getBytes(StandardCharsets.UTF_8));
            }
            byte[] d = sha.digest();
            long key = 0;
            for (int i = 0; i < 8; i++) key = (key << 8) | (d[i] & 0xff);
            return key;
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is always available", impossible);
        }
    }
}
