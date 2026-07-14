package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import com.towin.common.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LoginRateLimiterTest {

    private static final int MAX_TRACKED_KEYS = 100;
    private static final String EMAIL = "elder@example.com";

    private MutableClock clock;
    private LoginRateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new LoginRateLimiter(clock, MAX_TRACKED_KEYS);
    }

    // --- existing behaviour: 5 failures -> 15 minute lock, keyed by email ---

    @Test
    void fourFailures_doNotLock() {
        for (int i = 0; i < 4; i++) limiter.recordFailure(EMAIL);

        assertThatCode(() -> limiter.checkNotLocked(EMAIL)).doesNotThrowAnyException();
    }

    @Test
    void fifthFailure_locksTheKey() {
        for (int i = 0; i < 5; i++) limiter.recordFailure(EMAIL);

        assertThatThrownBy(() -> limiter.checkNotLocked(EMAIL))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("15 minutes");
    }

    @Test
    void lockElapsesAfterFifteenMinutes() {
        for (int i = 0; i < 5; i++) limiter.recordFailure(EMAIL);
        clock.advanceSeconds(Duration.ofMinutes(15).toSeconds() + 1);

        assertThatCode(() -> limiter.checkNotLocked(EMAIL)).doesNotThrowAnyException();
    }

    @Test
    void reset_clearsTheFailuresAfterASuccessfulLogin() {
        for (int i = 0; i < 4; i++) limiter.recordFailure(EMAIL);

        limiter.reset(EMAIL);

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void keyIgnoresCaseAndSurroundingSpace() {
        for (int i = 0; i < 5; i++) limiter.recordFailure("  ELDER@example.com ");

        assertThatThrownBy(() -> limiter.checkNotLocked(EMAIL))
                .isInstanceOf(RateLimitException.class);
    }

    @Test
    void oneKeysLockout_doesNotBlockAnotherKey() {
        for (int i = 0; i < 5; i++) limiter.recordFailure(EMAIL);

        assertThatCode(() -> limiter.checkNotLocked("helper@example.com")).doesNotThrowAnyException();
    }

    // --- the leak: attempts for keys that never come back must not pile up forever ---

    @Test
    void elapsedAttempts_areSweptAwayInsteadOfAccumulating() {
        for (int i = 0; i < MAX_TRACKED_KEYS; i++) {
            limiter.recordFailure("stranger-" + i + "@example.com");
        }
        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_KEYS);

        clock.advanceSeconds(Duration.ofMinutes(15).toSeconds() + 1);
        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void aLiveLockoutSurvivesTheSweep() {
        for (int i = 0; i < 5; i++) limiter.recordFailure(EMAIL);

        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isEqualTo(1);
        assertThatThrownBy(() -> limiter.checkNotLocked(EMAIL)).isInstanceOf(RateLimitException.class);
    }

    @Test
    void burstOfDistinctEmails_cannotGrowTheMapPastTheCap() {
        for (int i = 0; i < MAX_TRACKED_KEYS * 5; i++) {
            limiter.recordFailure("stranger-" + i + "@example.com");
        }

        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_KEYS);
    }
}
