package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import com.towin.common.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OtpRateLimiterTest {

    private static final int MAX_TRACKED_KEYS = 100;

    private MutableClock clock;
    private OtpRateLimiter limiter;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new OtpRateLimiter(clock, MAX_TRACKED_KEYS);
    }

    // --- existing behaviour: 3 sends per 15 minutes, 30s cooldown between sends ---

    @Test
    void firstRequest_isAllowed() {
        assertThatCode(() -> limiter.check(userId)).doesNotThrowAnyException();
    }

    @Test
    void secondRequestInsideTheCooldown_isBlocked() {
        limiter.check(userId);

        assertThatThrownBy(() -> limiter.check(userId))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("wait a moment");
    }

    @Test
    void requestAfterTheCooldown_isAllowed() {
        limiter.check(userId);
        clock.advanceSeconds(31);

        assertThatCode(() -> limiter.check(userId)).doesNotThrowAnyException();
    }

    @Test
    void fourthRequestInsideTheWindow_isBlocked() {
        for (int i = 0; i < 3; i++) {
            limiter.check(userId);
            clock.advanceSeconds(31); // clear the cooldown but stay inside the 15-minute window
        }

        assertThatThrownBy(() -> limiter.check(userId))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("Too many verification codes");
    }

    @Test
    void requestInAFreshWindow_isAllowedAgain() {
        for (int i = 0; i < 3; i++) {
            limiter.check(userId);
            clock.advanceSeconds(31);
        }
        clock.advanceSeconds(900);

        assertThatCode(() -> limiter.check(userId)).doesNotThrowAnyException();
    }

    @Test
    void oneUsersCooldown_doesNotBlockAnotherUser() {
        limiter.check(userId);

        assertThatCode(() -> limiter.check(UUID.randomUUID())).doesNotThrowAnyException();
    }

    // --- the leak: expired windows must not pile up forever ---

    @Test
    void expiredWindows_areSweptAwayInsteadOfAccumulating() {
        for (int i = 0; i < MAX_TRACKED_KEYS; i++) {
            limiter.check(UUID.randomUUID());
        }
        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_KEYS);

        clock.advanceSeconds(901); // every window has elapsed
        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void aLiveWindowSurvivesTheSweep() {
        limiter.check(userId);

        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isEqualTo(1);
    }

    @Test
    void burstOfDistinctUsers_cannotGrowTheMapPastTheCap() {
        for (int i = 0; i < MAX_TRACKED_KEYS * 5; i++) {
            limiter.check(UUID.randomUUID());
        }

        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_KEYS);
    }
}
