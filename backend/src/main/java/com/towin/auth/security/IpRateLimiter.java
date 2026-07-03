package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window per-IP limiter for unauthenticated auth endpoints (register,
 * guest). Stops a single source from mass-creating accounts or flooding the
 * auth surface. In-memory; single-instance app — move to Redis if it scales out.
 */
@Component
public class IpRateLimiter {

    private static final int  MAX_REQUESTS   = 10;   // per window, per IP
    private static final long WINDOW_SECONDS = 60;

    private static final class Window {
        int count;
        Instant resetAt;
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    /** Counts this request against the IP's window; throws once over the limit. */
    public void check(HttpServletRequest request) {
        String ip = clientIp(request);
        Instant now = Instant.now();
        Window w = windows.compute(ip, (k, existing) -> {
            if (existing == null || existing.resetAt.isBefore(now)) {
                existing = new Window();
                existing.resetAt = now.plusSeconds(WINDOW_SECONDS);
            }
            existing.count++;
            return existing;
        });
        if (w.count > MAX_REQUESTS) {
            throw new RateLimitException("Too many requests. Please wait a minute and try again.");
        }
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
