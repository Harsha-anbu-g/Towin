package com.towinly.family.service;

import com.towinly.common.exception.RateLimitException;
import com.towinly.common.security.ExpiringKeyStore;
import com.towinly.common.security.SweepableRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Per-caller fixed-window cap on FAILED family-request lookups: identifiers that
 * resolved to nobody, to the wrong role, across a block, or to a full elder.
 *
 * <p>The daily family-request cap counts SAVED rows, and a failed lookup saves
 * nothing — so before this guard, an authenticated account could run an email or
 * phone list through POST /family/requests for free and read membership off the
 * distinct answers. The distinct answers stay (an elder who typos their
 * daughter's email must be told, and the shipped apps can only show a 4xx
 * message), but a caller who keeps asking about people who aren't there is cut
 * off at the same 10-a-day the real sends get.
 *
 * <p>In-memory, single-instance app — same trade as {@code LoginRateLimiter};
 * move to Redis if it ever scales out.
 */
@Component
public class FamilyLookupRateLimiter implements SweepableRateLimiter {

    /** Mirrors FamilyService.MAX_REQUESTS_PER_DAY. */
    static final int  MAX_FAILED_LOOKUPS = 10;
    private static final long WINDOW_SECONDS = 24 * 60 * 60;

    private static final class Window {
        int count;
        Instant resetAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<UUID, Window> windows;

    public FamilyLookupRateLimiter() {
        this(Clock.systemUTC(), ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    FamilyLookupRateLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        this.windows = new ExpiringKeyStore<>(w -> w.resetAt, clock, maxEntries);
    }

    /** Throws once the caller has burned today's failed-lookup budget. */
    public void check(UUID callerId) {
        Window w = windows.get(callerId);
        if (w != null && w.count >= MAX_FAILED_LOOKUPS) {
            // The same sentence the row-counting cap uses, so the refusal itself
            // never says which cap was hit.
            throw new RateLimitException("Daily family request limit reached");
        }
    }

    /** Counts one failed lookup against the caller's daily window. */
    public void recordFailure(UUID callerId) {
        Instant now = clock.instant();
        windows.compute(callerId, (k, existing) -> {
            if (existing == null || existing.resetAt.isBefore(now)) {
                existing = new Window();
                existing.resetAt = now.plusSeconds(WINDOW_SECONDS);
            }
            existing.count++;
            return existing;
        });
    }

    @Override
    public void sweepExpired() {
        windows.sweep();
    }

    /** Callers currently tracked. Visible for tests. */
    int trackedKeys() {
        return windows.size();
    }
}
