package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import com.towin.common.security.ExpiringKeyStore;
import com.towin.common.security.SweepableRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Per-user fixed-window limiter for phone-OTP *requests*. Each OTP send fires a
 * real (paid) SMS, so an authenticated user must not be able to spam it. Caps
 * sends per user and enforces a short cooldown between sends. In-memory;
 * single-instance app — move to Redis if it ever scales out. Mirrors
 * {@link IpRateLimiter} / {@link LoginRateLimiter}.
 */
@Component
public class OtpRateLimiter implements SweepableRateLimiter {

    private static final int  MAX_REQUESTS    = 3;    // per window, per user
    private static final long WINDOW_SECONDS  = 900;  // 15 minutes
    private static final long COOLDOWN_SECONDS = 30;  // minimum gap between sends

    private static final class Window {
        int count;
        Instant resetAt;
        Instant lastRequestAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<UUID, Window> windows;

    public OtpRateLimiter() {
        this(Clock.systemUTC(), ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    OtpRateLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        this.windows = new ExpiringKeyStore<>(w -> w.resetAt, clock, maxEntries);
    }

    /** Counts this OTP request against the user's window; throws once over the limit. */
    public void check(UUID userId) {
        Instant now = clock.instant();
        Window w = windows.compute(userId, (k, existing) -> {
            if (existing == null || existing.resetAt.isBefore(now)) {
                existing = new Window();
                existing.resetAt = now.plusSeconds(WINDOW_SECONDS);
            }
            if (existing.lastRequestAt != null
                    && existing.lastRequestAt.plusSeconds(COOLDOWN_SECONDS).isAfter(now)) {
                throw new RateLimitException("Please wait a moment before requesting another code.");
            }
            existing.count++;
            existing.lastRequestAt = now;
            return existing;
        });
        // A null window means the store is at capacity and is not tracking this user
        // (see ExpiringKeyStore#compute) — the send is allowed rather than blocked.
        if (w != null && w.count > MAX_REQUESTS) {
            throw new RateLimitException("Too many verification codes requested. Try again in 15 minutes.");
        }
    }

    @Override
    public void sweepExpired() {
        windows.sweep();
    }

    /** Users currently tracked. Visible for tests. */
    int trackedKeys() {
        return windows.size();
    }
}
