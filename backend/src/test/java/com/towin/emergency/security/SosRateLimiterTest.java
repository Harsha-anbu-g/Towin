package com.towin.emergency.security;

import com.towin.common.exception.RateLimitException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SosRateLimiterTest {

    /** A clock the test can move forward, so windows and cooldowns are exercised for real. */
    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-07-12T12:00:00Z");

        void advanceSeconds(long seconds) { now = now.plusSeconds(seconds); }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private MutableClock clock;
    private SosRateLimiter limiter;
    private final UUID elderId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new SosRateLimiter(clock);
    }

    @Test
    void firstSos_isAllowed() {
        assertThatCode(() -> limiter.check(elderId)).doesNotThrowAnyException();
    }

    @Test
    void secondSosRightAway_isBlockedWithReassuringMessage() {
        limiter.check(elderId);

        assertThatThrownBy(() -> limiter.check(elderId))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("already sent");
    }

    @Test
    void sosAfterCooldownPasses_isAllowed() {
        limiter.check(elderId);
        clock.advanceSeconds(61);

        assertThatCode(() -> limiter.check(elderId)).doesNotThrowAnyException();
    }

    @Test
    void sixthSosWithinAnHour_isBlocked() {
        for (int i = 0; i < 5; i++) {
            limiter.check(elderId);
            clock.advanceSeconds(61); // clear the cooldown but stay inside the hour
        }

        assertThatThrownBy(() -> limiter.check(elderId))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("call");
    }

    @Test
    void sosInAFreshHourWindow_isAllowedAgain() {
        for (int i = 0; i < 5; i++) {
            limiter.check(elderId);
            clock.advanceSeconds(61);
        }
        clock.advanceSeconds(Duration.ofHours(1).toSeconds());

        assertThatCode(() -> limiter.check(elderId)).doesNotThrowAnyException();
    }

    @Test
    void oneUsersCooldown_doesNotBlockAnotherUser() {
        UUID otherElder = UUID.randomUUID();
        limiter.check(elderId);

        assertThatCode(() -> limiter.check(otherElder)).doesNotThrowAnyException();
    }

    // --- the leak: expired windows must not pile up forever ---

    @Test
    void expiredWindows_areSweptAwayInsteadOfAccumulating() {
        for (int i = 0; i < 100; i++) {
            limiter.check(UUID.randomUUID());
        }
        assertThat(limiter.trackedKeys()).isEqualTo(100);

        clock.advanceSeconds(Duration.ofHours(1).toSeconds() + 1);
        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void aLiveWindowSurvivesTheSweep() {
        limiter.check(elderId);

        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isEqualTo(1);
    }

    @Test
    void burstOfDistinctUsers_cannotGrowTheMapPastTheCap() {
        SosRateLimiter capped = new SosRateLimiter(clock, 100);

        for (int i = 0; i < 500; i++) {
            capped.check(UUID.randomUUID());
        }

        assertThat(capped.trackedKeys()).isEqualTo(100);
    }
}
