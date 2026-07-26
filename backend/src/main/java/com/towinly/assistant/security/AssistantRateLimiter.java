package com.towinly.assistant.security;

import com.towinly.common.exception.RateLimitException;
import com.towinly.common.security.ExpiringKeyStore;
import com.towinly.common.security.SweepableRateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Throttles the "Ask AI" help chat, which is public and spends real money per
 * call. Three limits, because each stops a different attack.
 *
 * <p><b>Per-identity, per-minute</b> stops a tight loop from one client.
 * <b>Per-identity, per-hour</b> stops a slow drip that stays under the minute
 * limit — one request every eight seconds all day would otherwise be free rein.
 *
 * <p><b>A whole-service daily ceiling</b> is the one that matters most, and the
 * reason this class exists rather than reusing {@link com.towinly.auth.security.IpRateLimiter}.
 * Per-identity limits are only as good as the identity: an attacker with a pool
 * of cloud IPs, or simply a mobile connection that re-dials for a new address,
 * presents a fresh key each time and never trips a per-key window. The daily
 * ceiling is not keyed on anything the caller controls, so it cannot be dodged
 * that way. It is a spend cap, not a fairness rule — once the day's budget is
 * gone the assistant goes quiet for everyone until the window rolls, which is the
 * correct failure: a silent tortoise costs nothing, an unbounded bill does.
 *
 * <p>Signed-in callers are keyed by user id rather than IP, so a household or care
 * home behind one address does not throttle itself — and so an attacker cannot
 * spend a real user's allowance by sharing their network.
 *
 * <p>In-memory; single-instance app — move to Redis if it ever scales out.
 */
@Slf4j
@Component
public class AssistantRateLimiter implements SweepableRateLimiter {

    /** A real person asks a question every few seconds at most; a script does not. */
    private static final int  MAX_PER_MINUTE = 8;
    private static final long MINUTE_SECONDS = 60;

    /** Generous for a long help session, far below what a drip attack needs. */
    private static final int  MAX_PER_HOUR = 60;
    private static final long HOUR_SECONDS = 3600;

    private static final long DAY_SECONDS = 86_400;

    private static final class Window {
        int minuteCount;
        Instant minuteResetAt;
        int hourCount;
        Instant hourResetAt;
    }

    private final Clock clock;
    private final ExpiringKeyStore<String, Window> windows;

    /** Whole-service calls per day. Tunable without a redeploy; see application.yml. */
    private final int maxPerDay;

    /** Guarded by {@code dayLock} — a burst of concurrent requests must not overspend. */
    private final Object dayLock = new Object();
    private int dayCount;
    private Instant dayResetAt;

    // Explicit: the class has a second, test-only constructor, and with more than one
    // candidate Spring falls back to looking for a no-arg constructor and fails to start.
    @Autowired
    public AssistantRateLimiter(@Value("${assistant.max-calls-per-day:2000}") int maxPerDay) {
        this(Clock.systemUTC(), ExpiringKeyStore.DEFAULT_MAX_ENTRIES, maxPerDay);
    }

    AssistantRateLimiter(Clock clock, int maxEntries, int maxPerDay) {
        this.clock = clock;
        this.windows = new ExpiringKeyStore<>(w -> w.hourResetAt, clock, maxEntries);
        this.maxPerDay = maxPerDay;
        this.dayResetAt = clock.instant().plusSeconds(DAY_SECONDS);
    }

    /**
     * Counts one chat request against every limit, throwing on the first one it
     * exceeds. {@code userId} is null for logged-out visitors, who are keyed by IP.
     *
     * @param userId   the signed-in user, or null
     * @param clientIp the trusted remote address (never a client-supplied header)
     */
    public void check(UUID userId, String clientIp) {
        checkDailyBudget();
        checkIdentity(userId != null ? "u:" + userId : "ip:" + clientIp);
    }

    /**
     * The un-dodgeable ceiling. Checked before the per-identity limits so a
     * rotating-key flood is stopped by the limit it cannot rotate around.
     */
    private void checkDailyBudget() {
        Instant now = clock.instant();
        synchronized (dayLock) {
            if (dayResetAt.isBefore(now)) {
                dayCount = 0;
                dayResetAt = now.plusSeconds(DAY_SECONDS);
            }
            if (dayCount >= maxPerDay) {
                log.warn("Ask AI daily budget of {} calls is spent; refusing until {}", maxPerDay, dayResetAt);
                throw new RateLimitException(
                        "The helper is resting just now and can't answer any more questions today. "
                        + "Please try again tomorrow, or use the Feedback button and the Towinly team will help.");
            }
            dayCount++;
        }
    }

    private void checkIdentity(String key) {
        Instant now = clock.instant();
        Window w = windows.compute(key, (k, existing) -> {
            if (existing == null) {
                existing = new Window();
                existing.minuteResetAt = now.plusSeconds(MINUTE_SECONDS);
                existing.hourResetAt = now.plusSeconds(HOUR_SECONDS);
            }
            // The store expires entries on the hour window, so only the inner
            // minute window has to roll itself over.
            if (existing.minuteResetAt.isBefore(now)) {
                existing.minuteCount = 0;
                existing.minuteResetAt = now.plusSeconds(MINUTE_SECONDS);
            }
            existing.minuteCount++;
            existing.hourCount++;
            return existing;
        });

        // A null window means the store is at capacity and is not tracking this key
        // (see ExpiringKeyStore#compute) — the request is served rather than blocked,
        // because blocking every untracked key would let a flood of distinct keys lock
        // out real users. The daily ceiling above still bounds the damage.
        if (w == null) {
            return;
        }
        if (w.minuteCount > MAX_PER_MINUTE) {
            throw new RateLimitException(
                    "You're asking faster than I can think! Please wait a moment and ask again.");
        }
        if (w.hourCount > MAX_PER_HOUR) {
            throw new RateLimitException(
                    "That's a lot of questions in one hour. Please take a short break and come back soon.");
        }
    }

    @Override
    public void sweepExpired() {
        windows.sweep();
    }

    /** Identities currently tracked. Visible for tests. */
    int trackedKeys() {
        return windows.size();
    }

    /** Calls charged against today's budget. Visible for tests. */
    int spentToday() {
        synchronized (dayLock) {
            return dayCount;
        }
    }
}
