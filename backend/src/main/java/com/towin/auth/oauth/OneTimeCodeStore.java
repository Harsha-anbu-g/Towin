package com.towin.auth.oauth;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory, single-use code store for the OAuth2 hand-off.
 * Each code is consumed on first read and expires after TTL.
 * Safe for a single Railway instance; replace the map with Redis if scaling out.
 */
@Component
public class OneTimeCodeStore {

    private record Entry(String payload, Instant expiresAt) {}

    private final ConcurrentHashMap<String, Entry> store = new ConcurrentHashMap<>();
    private static final Duration TTL = Duration.ofMinutes(15);
    private static final SecureRandom RANDOM = new SecureRandom();

    public String store(String payload) {
        String code = generateCode();
        store.put(code, new Entry(payload, Instant.now().plus(TTL)));
        return code;
    }

    public Optional<String> consume(String code) {
        if (code == null) return Optional.empty();
        Entry entry = store.remove(code);
        if (entry == null || entry.expiresAt().isBefore(Instant.now())) return Optional.empty();
        return Optional.of(entry.payload());
    }

    private String generateCode() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
