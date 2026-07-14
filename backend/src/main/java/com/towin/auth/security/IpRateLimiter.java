package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import com.towin.common.security.ExpiringKeyStore;
import com.towin.common.security.SweepableRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;

/**
 * Fixed-window per-IP limiter for unauthenticated auth endpoints (register,
 * guest). Stops a single source from mass-creating accounts or flooding the
 * auth surface. In-memory; single-instance app — move to Redis if it scales out.
 */
@Component
public class IpRateLimiter implements SweepableRateLimiter {

    private static final int  MAX_REQUESTS   = 10;   // per window, per IP
    private static final long WINDOW_SECONDS = 60;

    private static final class Window {
        int count;
        Instant resetAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<String, Window> windows;

    public IpRateLimiter() {
        this(Clock.systemUTC(), ExpiringKeyStore.DEFAULT_MAX_ENTRIES);
    }

    IpRateLimiter(Clock clock, int maxEntries) {
        this.clock = clock;
        this.windows = new ExpiringKeyStore<>(w -> w.resetAt, clock, maxEntries);
    }

    /** Counts this request against the IP's window; throws once over the limit. */
    public void check(HttpServletRequest request) {
        String ip = clientIp(request);
        Instant now = clock.instant();
        Window w = windows.compute(ip, (k, existing) -> {
            if (existing == null || existing.resetAt.isBefore(now)) {
                existing = new Window();
                existing.resetAt = now.plusSeconds(WINDOW_SECONDS);
            }
            existing.count++;
            return existing;
        });
        // A null window means the store is at capacity and is not tracking this IP —
        // the request is served rather than blocked (see ExpiringKeyStore#compute).
        if (w != null && w.count > MAX_REQUESTS) {
            throw new RateLimitException("Too many requests. Please wait a minute and try again.");
        }
    }

    @Override
    public void sweepExpired() {
        windows.sweep();
    }

    /** IPs currently tracked. Visible for tests. */
    int trackedKeys() {
        return windows.size();
    }

    /**
     * The real client IP. The app runs behind Railway's edge with
     * {@code forward-headers-strategy: framework}, so Spring's ForwardedHeaderFilter
     * resolves the genuine client address into {@code getRemoteAddr()} and strips
     * {@code X-Forwarded-For} before this code runs. Verified in production: a spoofed
     * {@code X-Forwarded-For} does not change {@code getRemoteAddr()} (the header is
     * already null here). We deliberately do NOT parse {@code X-Forwarded-For}
     * ourselves — its leftmost entry is client-controlled and spoofable, which would
     * let an attacker rotate the header to dodge the per-IP limit. {@code getRemoteAddr()}
     * is the trusted value.
     */
    private String clientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
