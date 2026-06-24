package com.towin.common.seed;

import com.towin.common.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ScheduledFuture;
import java.util.stream.Collectors;

/**
 * Resets the public demo accounts back to their baseline, but only after a
 * visitor actually changes one — never on a fixed timer. With few visitors this
 * means the reset runs only when something was touched, instead of churning the
 * database every N minutes for nothing.
 *
 * <p>The reset is <b>debounced</b>: each change (re)schedules the reset for
 * {@code app.demo.reset-delay-ms} from now, so a visitor keeps their changes
 * while they're active and everything reverts once the demo goes quiet. The
 * change signal comes from {@link DemoActivityInterceptor}; the actual
 * restore is {@link DemoDataSeeder#resetDemo()}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.demo", name = "seed-enabled", havingValue = "true", matchIfMissing = true)
public class DemoResetCoordinator {

    private final DemoDataSeeder seeder;
    private final UserRepository userRepository;

    @Value("${app.demo.reset-enabled:true}")
    private boolean resetEnabled;

    // Quiet period after the last demo change before reverting. Default 15 min.
    @Value("${app.demo.reset-delay-ms:900000}")
    private long resetDelayMs;

    private ThreadPoolTaskScheduler scheduler;
    private volatile Set<UUID> demoUserIds;
    private ScheduledFuture<?> pending;

    @PostConstruct
    void start() {
        scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("demo-reset-");
        scheduler.setRemoveOnCancelPolicy(true);
        scheduler.initialize();
    }

    @PreDestroy
    void stop() {
        if (scheduler != null) scheduler.shutdown();
    }

    /**
     * Record a successful write by an authenticated user. No-op unless that user
     * is a demo account and reset is enabled — the cheap guard runs lock-free so
     * ordinary API traffic isn't serialized; only a real demo write takes the
     * scheduling lock. Debounced: each call cancels any pending reset and
     * reschedules it, so the reset fires once a quiet period after the last change.
     */
    public void onDemoWrite(UUID userId) {
        if (!resetEnabled || userId == null || !demoUserIds().contains(userId)) return;
        scheduleReset(userId);
    }

    private synchronized void scheduleReset(UUID userId) {
        if (pending != null) pending.cancel(false);
        pending = scheduler.schedule(this::runReset, Instant.now().plusMillis(resetDelayMs));
        log.info("Demo account {} changed — reset scheduled in {} ms", userId, resetDelayMs);
    }

    private void runReset() {
        try {
            seeder.resetDemo();
            log.info("Demo accounts reset to baseline after visitor changes");
        } catch (Exception e) {
            log.error("Demo reset failed (app continues normally)", e);
        }
    }

    /** Demo user ids, resolved from {@link DemoDataSeeder#DEMO_EMAILS} and cached.
     *  Resolved lazily on the first demo write, by which point the accounts exist
     *  (they are seeded at boot). Ids never change, so caching is safe. */
    private Set<UUID> demoUserIds() {
        Set<UUID> ids = demoUserIds;
        if (ids == null || ids.isEmpty()) {
            ids = DemoDataSeeder.DEMO_EMAILS.stream()
                    .map(userRepository::findByEmail)
                    .filter(Optional::isPresent)
                    .map(o -> o.get().getId())
                    .collect(Collectors.toUnmodifiableSet());
            demoUserIds = ids;
        }
        return ids;
    }
}
