package com.towin.common.security;

import lombok.extern.slf4j.Slf4j;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * A key → window map that forgets entries once their window has elapsed, and never
 * holds more than {@code maxEntries} keys. Backing store for the rate limiters, which
 * would otherwise keep a key for every IP or user they ever saw: a plain map only
 * replaces an expired entry when that same key comes back, so traffic from many
 * distinct keys grows it for the life of the process.
 *
 * <p>Two things bound it. {@link RateLimiterSweeper} calls {@link #sweep()} on a
 * schedule, which is what reclaims memory in the steady state. The cap is the backstop
 * for a burst that arrives between sweeps: at capacity a write first tries to reclaim
 * expired entries, and only if the store is genuinely full of live windows does it
 * refuse to track a new key.
 *
 * <p>Refusing means the caller gets {@code null} from {@link #compute} and, by
 * convention, lets the request through. That is deliberate: the alternative — blocking
 * every untracked key — would let a flood of distinct keys lock out every legitimate
 * user, turning the memory bound into a far worse denial of service. A key that cannot
 * be counted is not rate-limited; it is never punished for the store being full.
 *
 * <p>In-memory; single-instance app — move to Redis if it ever scales out.
 *
 * @param <K> the limiter's key (an IP, an email, a user id)
 * @param <V> the limiter's window/attempt record
 */
@Slf4j
public final class ExpiringKeyStore<K, V> {

    /** Generous next to real traffic, small next to the heap: a burst is capped, normal use never is. */
    public static final int DEFAULT_MAX_ENTRIES = 50_000;

    /** When the entry stops mattering. An entry with no expiry cannot be reasoned about, so it is evictable. */
    private final Function<V, Instant> expiryOf;
    private final Clock clock;
    private final int maxEntries;
    private final ConcurrentHashMap<K, V> entries = new ConcurrentHashMap<>();

    public ExpiringKeyStore(Function<V, Instant> expiryOf, Clock clock) {
        this(expiryOf, clock, DEFAULT_MAX_ENTRIES);
    }

    public ExpiringKeyStore(Function<V, Instant> expiryOf, Clock clock, int maxEntries) {
        this.expiryOf = expiryOf;
        this.clock = clock;
        this.maxEntries = maxEntries;
    }

    /** The live entry for this key, or {@code null} if it is absent or its window has elapsed. */
    public V get(K key) {
        V existing = entries.get(key);
        if (existing == null) {
            return null;
        }
        if (isExpired(existing, clock.instant())) {
            entries.remove(key, existing);
            return null;
        }
        return existing;
    }

    /**
     * Like {@link ConcurrentHashMap#compute}, with two differences: an expired entry is
     * handed to {@code remapping} as {@code null}, so a fresh window starts exactly as it
     * would have on a first visit; and a key the store has no room for is refused.
     *
     * @return the stored window, or {@code null} when the store is full of live windows
     *         and is therefore not tracking this key (the caller should allow the request)
     */
    public V compute(K key, BiFunction<K, V, V> remapping) {
        Instant now = clock.instant();
        if (!entries.containsKey(key) && entries.size() >= maxEntries) {
            sweep(); // a burst of new keys pays for the cleanup it forces
            if (entries.size() >= maxEntries) {
                log.warn("Rate-limiter store is full ({} live entries); not tracking new key", maxEntries);
                return null;
            }
        }
        return entries.compute(key, (k, existing) ->
                remapping.apply(k, existing != null && isExpired(existing, now) ? null : existing));
    }

    /** Forget this key entirely. */
    public void remove(K key) {
        entries.remove(key);
    }

    /** Drops every entry whose window has already elapsed. Called on a schedule. */
    public void sweep() {
        Instant now = clock.instant();
        entries.values().removeIf(entry -> isExpired(entry, now));
    }

    /** Keys currently tracked. */
    public int size() {
        return entries.size();
    }

    private boolean isExpired(V entry, Instant now) {
        Instant expiresAt = expiryOf.apply(entry);
        return expiresAt == null || expiresAt.isBefore(now);
    }
}
