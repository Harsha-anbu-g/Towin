package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import com.towin.common.security.ExpiringKeyStore;
import com.towin.common.security.SweepableRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;

/**
 * In-memory brute-force guard for login. The app runs single-instance, so a
 * process-local counter is sufficient; if it ever scales out, swap the backing
 * store for Redis. Mirrors the phone-OTP policy: 5 failures → 15-minute lock,
 * keyed by email so one account can't be hammered.
 *
 * <p>An attempt is forgotten once it has been idle for the lockout window: an
 * elapsed lock starts fresh (as it always did), and a part-way failure count for
 * a key that never comes back is reclaimed instead of being held for the life of
 * the process. The policy is unchanged — 5 failures inside 15 minutes still locks.
 *
 * <p>Unlike the throughput limiters, this one fails <em>closed</em>: if the backing
 * store is saturated and cannot track a key, the login is denied rather than let
 * through, so a flood of junk identifiers can't quietly switch the guard off. That
 * never blocks a real sign-in — a correct password is honoured before this check runs.
 */
@Component
public class LoginRateLimiter implements SweepableRateLimiter {

    private static final int  MAX_FAILURES    = 5;
    private static final long LOCKOUT_MINUTES = 15;

    private static final class Attempt {
        int failures;
        Instant lockedUntil;
        Instant lastFailureAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<String, Attempt> attempts;

    public LoginRateLimiter() {
        this(Clock.systemUTC(), ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    LoginRateLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        // An attempt is dead once its lockout window has elapsed; for a key that never
        // reached the threshold that is simply 15 minutes after its last failure.
        this.attempts = new ExpiringKeyStore<>(
                a -> a.lastFailureAt.plusSeconds(LOCKOUT_MINUTES * 60), clock, maxEntries);
    }

    /** Throws if the key is currently locked out. Call before checking credentials. */
    public void checkNotLocked(String email) {
        // An elapsed lock has expired, so the store reads it as absent — the key starts fresh.
        Attempt a = attempts.get(key(email));
        if (a != null && a.lockedUntil != null && a.lockedUntil.isAfter(clock.instant())) {
            throw new RateLimitException("Too many attempts. Try again in 15 minutes.");
        }
        // Fail CLOSED, not open. If the store is saturated (a flood of junk identifiers
        // filling it with live windows) it can no longer track this key — and a lockout
        // guard that waves an untracked key through is silently disabled, letting the
        // flood double as cover for guessing a real account. Denying instead cannot lock
        // a genuine user out: a correct password short-circuits in AuthService before this
        // check runs, so only wrong-credential attempts ever reach here.
        if (a == null && attempts.isFull()) {
            throw new RateLimitException("Too many attempts right now. Try again in a minute.");
        }
    }

    /** Record a failed login; locks the key once it crosses the threshold. */
    public void recordFailure(String email) {
        Instant now = clock.instant();
        attempts.compute(key(email), (k, a) -> {
            if (a == null) a = new Attempt();
            a.failures++;
            a.lastFailureAt = now;
            if (a.failures >= MAX_FAILURES) {
                a.lockedUntil = now.plusSeconds(LOCKOUT_MINUTES * 60);
            }
            return a;
        });
    }

    /** Clear all state for a key after a successful login. */
    public void reset(String email) {
        attempts.remove(key(email));
    }

    @Override
    public void sweepExpired() {
        attempts.sweep();
    }

    /** Keys currently tracked. Visible for tests. */
    int trackedKeys() {
        return attempts.size();
    }

    private String key(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
