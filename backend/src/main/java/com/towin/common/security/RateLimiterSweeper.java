package com.towin.common.security;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Reclaims expired entries from every in-memory rate limiter, so their maps track
 * live traffic instead of growing for the life of the process. Without this a key
 * is only ever cleaned up when that same key comes back, so traffic from many
 * distinct IPs or users leaks memory.
 *
 * <p>Scheduling is already enabled app-wide (see
 * {@link com.towin.common.config.SchedulingConfig}), so a scheduled sweep is the
 * cheapest correct home for this. In-memory; single-instance app — move to Redis
 * if it ever scales out.
 */
@Component
@RequiredArgsConstructor
public class RateLimiterSweeper {

    /** Shorter than the shortest limiter window (60s), so expired keys never linger long. */
    private static final long SWEEP_INTERVAL_MS = 60_000;

    private final List<SweepableRateLimiter> limiters;

    @Scheduled(fixedDelay = SWEEP_INTERVAL_MS)
    public void sweepExpiredEntries() {
        limiters.forEach(SweepableRateLimiter::sweepExpired);
    }
}
