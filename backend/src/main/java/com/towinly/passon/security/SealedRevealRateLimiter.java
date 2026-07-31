package com.towinly.passon.security;

import com.towinly.common.exception.RateLimitException;
import com.towinly.common.security.ExpiringKeyStore;
import com.towinly.common.security.SweepableRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Brute-force guard on opening a Sealed box, keyed by the owner's own id.
 *
 * Every other credential-checking surface in this app has one of these, and this is the one
 * that matters most: the thing behind the password is a bank account number rather than a
 * session. The attacker here is not anonymous — they are already signed in as the elder,
 * because they picked up her unlocked phone or hold her mailbox — so the key is the user id
 * and not an IP.
 *
 * Mirrors {@link com.towinly.auth.security.LoginRateLimiter} exactly, including its
 * <em>fail-closed</em> stance: if the backing store is saturated and cannot track a key, the
 * reveal is refused rather than let through. A guard that waves untracked keys past is a
 * guard that can be switched off by flooding it. That never blocks the real owner for long —
 * she types the right password and the counter is cleared.
 *
 * In-memory; single-instance app — move to Redis if it ever scales out.
 */
@Component
public class SealedRevealRateLimiter implements SweepableRateLimiter {

    private static final int  MAX_FAILURES    = 5;
    private static final long LOCKOUT_MINUTES = 15;

    /**
     * Plain words, and no scolding. The person reading this is nearly always the owner
     * getting her own password wrong, not an attacker.
     */
    public static final String TOO_MANY_TRIES =
            "That password has been tried too many times. Please wait 15 minutes and try again.";

    /** The same sentence when the guard itself is under load: still a refusal, still kind. */
    public static final String BUSY =
            "We can't open the box just now. Please try again in a minute.";

    private static final class Attempt {
        int failures;
        Instant lockedUntil;
        Instant lastFailureAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<UUID, Attempt> attempts;

    public SealedRevealRateLimiter() {
        this(Clock.systemUTC(), ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    public SealedRevealRateLimiter(Clock clock) {
        this(clock, ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    SealedRevealRateLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        // An attempt is dead once its lockout window has elapsed; for a key that never
        // reached the threshold that is simply 15 minutes after its last failure.
        this.attempts = new ExpiringKeyStore<>(
                a -> a.lastFailureAt.plusSeconds(LOCKOUT_MINUTES * 60), clock, maxEntries);
    }

    /** Throws if this owner is currently locked out. Call before checking the password. */
    public void checkNotLocked(UUID ownerId) {
        Attempt a = attempts.get(ownerId);
        if (a != null && a.lockedUntil != null && a.lockedUntil.isAfter(clock.instant())) {
            throw new RateLimitException(TOO_MANY_TRIES);
        }
        if (a == null && attempts.isFull()) {
            throw new RateLimitException(BUSY);
        }
    }

    /** Record a wrong password; locks this owner once it crosses the threshold. */
    public void recordFailure(UUID ownerId) {
        Instant now = clock.instant();
        attempts.compute(ownerId, (k, a) -> {
            if (a == null) a = new Attempt();
            a.failures++;
            a.lastFailureAt = now;
            if (a.failures >= MAX_FAILURES) {
                a.lockedUntil = now.plusSeconds(LOCKOUT_MINUTES * 60);
            }
            return a;
        });
    }

    /** Clear the count after the right password. */
    public void reset(UUID ownerId) {
        attempts.remove(ownerId);
    }

    @Override
    public void sweepExpired() {
        attempts.sweep();
    }

    /** Owners currently tracked. Visible for tests. */
    int trackedKeys() {
        return attempts.size();
    }
}
