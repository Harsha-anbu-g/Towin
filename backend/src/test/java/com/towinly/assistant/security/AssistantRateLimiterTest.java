package com.towinly.assistant.security;

import com.towinly.common.exception.RateLimitException;
import com.towinly.common.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AssistantRateLimiterTest {

    private static final int MAX_TRACKED = 100;
    private static final int MAX_PER_DAY = 50;
    private static final String IP = "10.0.0.1";

    /** Big enough to stay out of the way when a per-identity limit is what's under test. */
    private static final int UNLIMITED_DAY = 1_000_000;

    private MutableClock clock;
    private AssistantRateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new AssistantRateLimiter(clock, MAX_TRACKED, UNLIMITED_DAY);
    }

    /** A limiter whose daily ceiling is the limit under test. */
    private AssistantRateLimiter withDailyBudget(int maxPerDay) {
        return new AssistantRateLimiter(clock, MAX_TRACKED, maxPerDay);
    }

    // --- per-identity, per-minute ---

    @Test
    void eightQuestionsInAMinute_areAllowed() {
        assertThatCode(() -> {
            for (int i = 0; i < 8; i++) limiter.check(null, IP);
        }).doesNotThrowAnyException();
    }

    @Test
    void theNinthQuestionInAMinute_isBlockedKindly() {
        for (int i = 0; i < 8; i++) limiter.check(null, IP);

        assertThatThrownBy(() -> limiter.check(null, IP))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("wait a moment");
    }

    @Test
    void aFreshMinute_letsThemAskAgain() {
        for (int i = 0; i < 8; i++) limiter.check(null, IP);
        clock.advanceSeconds(61);

        assertThatCode(() -> limiter.check(null, IP)).doesNotThrowAnyException();
    }

    // --- per-identity, per-hour: the slow drip that stays under the minute limit ---

    @Test
    void aSlowDripUnderTheMinuteLimit_isStoppedByTheHourLimit() {
        // 8 a minute would be 480 an hour. Drip 6 a minute and the minute window is
        // never tripped - only the hourly cap catches this.
        int served = 0;
        try {
            for (int minute = 0; minute < 20; minute++) {
                for (int i = 0; i < 6; i++) {
                    limiter.check(null, IP);
                    served++;
                }
                clock.advanceSeconds(61);
            }
        } catch (RateLimitException e) {
            assertThat(e).hasMessageContaining("take a short break");
        }

        assertThat(served).isEqualTo(60); // MAX_PER_HOUR, not the 120 the drip attempted
    }

    // --- the daily ceiling: the limit an attacker cannot rotate around ---

    @Test
    void rotatingIps_cannotDodgeTheDailyBudget() {
        // Every request comes from a brand-new address, so no per-identity window is
        // ever tripped. This is the attack the daily ceiling exists to stop.
        AssistantRateLimiter capped = withDailyBudget(MAX_PER_DAY);
        for (int i = 0; i < MAX_PER_DAY; i++) {
            capped.check(null, "10.9." + (i / 256) + "." + (i % 256));
        }

        assertThatThrownBy(() -> capped.check(null, "10.9.255.255"))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("resting");
    }

    @Test
    void rotatingUserIds_cannotDodgeTheDailyBudgetEither() {
        AssistantRateLimiter capped = withDailyBudget(MAX_PER_DAY);
        for (int i = 0; i < MAX_PER_DAY; i++) {
            capped.check(UUID.randomUUID(), IP);
        }

        assertThatThrownBy(() -> capped.check(UUID.randomUUID(), IP))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("resting");
    }

    @Test
    void theDailyBudgetRefills_theNextDay() {
        AssistantRateLimiter capped = withDailyBudget(MAX_PER_DAY);
        for (int i = 0; i < MAX_PER_DAY; i++) capped.check(null, "10.9.0." + i);
        clock.advanceSeconds(86_401);

        assertThatCode(() -> capped.check(null, IP)).doesNotThrowAnyException();
        assertThat(capped.spentToday()).isEqualTo(1);
    }

    @Test
    void aBlockedRequest_isStillChargedToTheDay_soFloodingCannotBeFree() {
        for (int i = 0; i < 9; i++) {
            try {
                limiter.check(null, IP);
            } catch (RateLimitException ignored) {
                // the 9th trips the minute window
            }
        }

        assertThat(limiter.spentToday()).isEqualTo(9);
    }

    // --- identity choice ---

    @Test
    void signedInPeopleAreKeyedByAccount_soAHouseholdDoesNotThrottleItself() {
        UUID gran = UUID.randomUUID();
        UUID grandson = UUID.randomUUID();
        for (int i = 0; i < 8; i++) limiter.check(gran, IP);

        // Same address, different account - must not inherit her exhausted window.
        assertThatCode(() -> limiter.check(grandson, IP)).doesNotThrowAnyException();
    }

    @Test
    void oneVisitorsFlood_doesNotBlockAnother() {
        for (int i = 0; i < 8; i++) limiter.check(null, IP);

        assertThatCode(() -> limiter.check(null, "10.0.0.2")).doesNotThrowAnyException();
    }

    // --- memory bounds, matching the other limiters ---

    @Test
    void expiredWindows_areSweptAway() {
        for (int i = 0; i < MAX_TRACKED; i++) limiter.check(null, "10.0.1." + i);
        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED);

        clock.advanceSeconds(3601);
        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void aBurstOfDistinctKeys_cannotGrowTheMapPastTheCap() {
        for (int i = 0; i < MAX_TRACKED * 5; i++) {
            limiter.check(null, "10.1." + (i / 256) + "." + (i % 256));
        }

        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED);
    }
}
