package com.towinly.profile.security;

import com.towinly.common.exception.RateLimitException;
import com.towinly.common.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneChangeRateLimiterTest {

    private static final int MAX_TRACKED_KEYS = 10;

    private MutableClock clock;
    private PhoneChangeRateLimiter limiter;
    private final UUID user = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new PhoneChangeRateLimiter(clock, MAX_TRACKED_KEYS);
    }

    @Test
    void fiveChangesADay_areAllowed() {
        for (int i = 0; i < 5; i++) {
            assertThatCode(() -> limiter.check(user)).doesNotThrowAnyException();
        }
    }

    @Test
    void theSixthChange_isRefused_soAListOfNumbersCannotBeChecked() {
        for (int i = 0; i < 5; i++) limiter.check(user);
        assertThatThrownBy(() -> limiter.check(user)).isInstanceOf(RateLimitException.class);
    }

    @Test
    void theCapResetsAfterADay() {
        for (int i = 0; i < 6; i++) {
            try { limiter.check(user); } catch (RateLimitException ignored) { }
        }
        clock.advanceSeconds(86_401);
        assertThatCode(() -> limiter.check(user)).doesNotThrowAnyException();
    }

    @Test
    void oneUsersCap_doesNotTouchAnother() {
        for (int i = 0; i < 6; i++) {
            try { limiter.check(user); } catch (RateLimitException ignored) { }
        }
        assertThatCode(() -> limiter.check(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void aSaturatedStore_refusesAnUntrackedUser() {
        for (int i = 0; i < MAX_TRACKED_KEYS; i++) limiter.check(UUID.randomUUID());
        assertThatThrownBy(() -> limiter.check(UUID.randomUUID())).isInstanceOf(RateLimitException.class);
    }
}
