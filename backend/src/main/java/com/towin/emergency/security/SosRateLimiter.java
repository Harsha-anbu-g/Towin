package com.towin.emergency.security;

import com.towin.common.exception.RateLimitException;
import com.towin.common.security.ExpiringKeyStore;
import com.towin.common.security.SweepableRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Per-user fixed-window limiter for SOS triggers. Each SOS fans out a real
 * (paid) SMS to every emergency contact, so an authenticated user must not be
 * able to spam it — that burns Twilio credit and harasses the contacts. The
 * limits stay generous because this is an emergency button: one alert per
 * minute, five per hour, and the block messages reassure rather than scold.
 * In-memory; single-instance app — move to Redis if it ever scales out.
 * Mirrors {@link com.towin.auth.security.OtpRateLimiter}.
 */
@Component
public class SosRateLimiter implements SweepableRateLimiter {

    private static final int  MAX_REQUESTS     = 5;    // per window, per user
    private static final long WINDOW_SECONDS   = 3600; // 1 hour
    private static final long COOLDOWN_SECONDS = 60;   // minimum gap between alerts

    private static final class Window {
        int count;
        Instant resetAt;
        Instant lastRequestAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<UUID, Window> windows;

    public SosRateLimiter() {
        this(Clock.systemUTC());
    }

    SosRateLimiter(Clock clock) {
        this(clock, ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    SosRateLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        this.windows = new ExpiringKeyStore<>(w -> w.resetAt, clock, maxEntries);
    }

    /** Counts this SOS against the user's window; throws once over the limit. */
    public void check(UUID userId) {
        Instant now = clock.instant();
        Window w = windows.compute(userId, (k, existing) -> {
            if (existing == null || existing.resetAt.isBefore(now)) {
                existing = new Window();
                existing.resetAt = now.plusSeconds(WINDOW_SECONDS);
            }
            if (existing.lastRequestAt != null
                    && existing.lastRequestAt.plusSeconds(COOLDOWN_SECONDS).isAfter(now)) {
                throw new RateLimitException(
                        "Your alert was already sent. Your contacts have been told and help is on the way.");
            }
            existing.count++;
            existing.lastRequestAt = now;
            return existing;
        });
        // A null window means the store is at capacity and is not tracking this user
        // (see ExpiringKeyStore#compute) — an emergency alert is never withheld for that.
        if (w != null && w.count > MAX_REQUESTS) {
            throw new RateLimitException(
                    "You have sent several alerts this hour. Please call your emergency contact directly.");
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
