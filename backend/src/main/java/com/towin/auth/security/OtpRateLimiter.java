package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-user fixed-window limiter for phone-OTP *requests*. Each OTP send fires a
 * real (paid) SMS, so an authenticated user must not be able to spam it. Caps
 * sends per user and enforces a short cooldown between sends. In-memory;
 * single-instance app — move to Redis if it ever scales out. Mirrors
 * {@link IpRateLimiter} / {@link LoginRateLimiter}.
 */
@Component
public class OtpRateLimiter {

    private static final int  MAX_REQUESTS    = 3;    // per window, per user
    private static final long WINDOW_SECONDS  = 900;  // 15 minutes
    private static final long COOLDOWN_SECONDS = 30;  // minimum gap between sends

    private static final class Window {
        int count;
        Instant resetAt;
        Instant lastRequestAt;
    }

    private final ConcurrentHashMap<UUID, Window> windows = new ConcurrentHashMap<>();

    /** Counts this OTP request against the user's window; throws once over the limit. */
    public void check(UUID userId) {
        Instant now = Instant.now();
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
        if (w.count > MAX_REQUESTS) {
            throw new RateLimitException("Too many verification codes requested. Try again in 15 minutes.");
        }
    }
}
