package com.towinly.profile.security;

import com.towinly.common.exception.RateLimitException;
import com.towinly.common.security.ExpiringKeyStore;
import com.towinly.common.security.SweepableRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Per-user cap on phone number changes. A phone number is unique, so a refused
 * change says the number already belongs to a member. One person fixing a typo
 * needs a handful of tries; checking a list of numbers needs thousands, and this
 * is what tells the two apart. Mirrors {@link com.towinly.auth.security.OtpRateLimiter}.
 */
@Component
public class PhoneChangeRateLimiter implements SweepableRateLimiter {

    private static final int  MAX_CHANGES    = 5;     // per window, per user
    private static final long WINDOW_SECONDS = 86_400; // 24 hours

    private static final class Window {
        int count;
        Instant resetAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<UUID, Window> windows;

    public PhoneChangeRateLimiter() {
        this(Clock.systemUTC(), ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    PhoneChangeRateLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        this.windows = new ExpiringKeyStore<>(w -> w.resetAt, clock, maxEntries);
    }

    /** Counts one change attempt against the user's window; throws once over the limit. */
    public void check(UUID userId) {
        Instant now = clock.instant();
        Window w = windows.compute(userId, (k, existing) -> {
            if (existing == null || existing.resetAt.isBefore(now)) {
                existing = new Window();
                existing.resetAt = now.plusSeconds(WINDOW_SECONDS);
            }
            existing.count++;
            return existing;
        });
        // Fail closed: an untracked user on a saturated store is refused, so a flood
        // cannot switch the cap off. Changing a phone number is never urgent.
        if (w == null || w.count > MAX_CHANGES) {
            throw new RateLimitException("Too many phone number changes. Try again tomorrow.");
        }
    }

    @Override
    public void sweepExpired() {
        windows.sweep();
    }
}
