package com.towin.emergency.security;

import com.towin.common.exception.RateLimitException;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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
public class SosRateLimiter {

    private static final int  MAX_REQUESTS     = 5;    // per window, per user
    private static final long WINDOW_SECONDS   = 3600; // 1 hour
    private static final long COOLDOWN_SECONDS = 60;   // minimum gap between alerts

    private static final class Window {
        int count;
        Instant resetAt;
        Instant lastRequestAt;
    }

    private final Clock clock;
    private final ConcurrentHashMap<UUID, Window> windows = new ConcurrentHashMap<>();

    public SosRateLimiter() {
        this(Clock.systemUTC());
    }

    SosRateLimiter(Clock clock) {
        this.clock = clock;
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
        if (w.count > MAX_REQUESTS) {
            throw new RateLimitException(
                    "You have sent several alerts this hour. Please call your emergency contact directly.");
        }
    }
}
