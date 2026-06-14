package com.towin.auth.security;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory brute-force guard for login. The app runs single-instance, so a
 * process-local counter is sufficient; if it ever scales out, swap the backing
 * store for Redis. Mirrors the phone-OTP policy: 5 failures → 15-minute lock,
 * keyed by email so one account can't be hammered.
 */
@Component
public class LoginRateLimiter {

    private static final int  MAX_FAILURES    = 5;
    private static final long LOCKOUT_MINUTES = 15;

    private static final class Attempt {
        int failures;
        Instant lockedUntil;
    }

    private final ConcurrentHashMap<String, Attempt> attempts = new ConcurrentHashMap<>();

    /** Throws if the key is currently locked out. Call before checking credentials. */
    public void checkNotLocked(String email) {
        String key = key(email);
        Attempt a = attempts.get(key);
        if (a != null && a.lockedUntil != null) {
            if (a.lockedUntil.isAfter(Instant.now())) {
                throw new IllegalArgumentException("Too many attempts. Try again in 15 minutes.");
            }
            attempts.remove(key); // lock window elapsed — start fresh
        }
    }

    /** Record a failed login; locks the key once it crosses the threshold. */
    public void recordFailure(String email) {
        attempts.compute(key(email), (k, a) -> {
            if (a == null) a = new Attempt();
            a.failures++;
            if (a.failures >= MAX_FAILURES) {
                a.lockedUntil = Instant.now().plusSeconds(LOCKOUT_MINUTES * 60);
            }
            return a;
        });
    }

    /** Clear all state for a key after a successful login. */
    public void reset(String email) {
        attempts.remove(key(email));
    }

    private String key(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
