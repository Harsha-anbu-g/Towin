package com.towin.auth.security;

import com.towin.common.exception.RateLimitException;
import com.towin.common.support.MutableClock;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IpRateLimiterTest {

    private static final int MAX_TRACKED_IPS = 100;

    private MutableClock clock;
    private IpRateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new IpRateLimiter(clock, MAX_TRACKED_IPS);
    }

    private HttpServletRequest requestFrom(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        return request;
    }

    // --- existing behaviour: 10 requests per 60s window, per IP ---

    @Test
    void tenRequestsInOneWindow_areAllowed() {
        HttpServletRequest request = requestFrom("10.0.0.1");

        assertThatCode(() -> {
            for (int i = 0; i < 10; i++) limiter.check(request);
        }).doesNotThrowAnyException();
    }

    @Test
    void eleventhRequestInOneWindow_isBlocked() {
        HttpServletRequest request = requestFrom("10.0.0.1");
        for (int i = 0; i < 10; i++) limiter.check(request);

        assertThatThrownBy(() -> limiter.check(request))
                .isInstanceOf(RateLimitException.class)
                .hasMessageContaining("Too many requests");
    }

    @Test
    void requestInAFreshWindow_isAllowedAgain() {
        HttpServletRequest request = requestFrom("10.0.0.1");
        for (int i = 0; i < 10; i++) limiter.check(request);

        clock.advanceSeconds(61);

        assertThatCode(() -> limiter.check(request)).doesNotThrowAnyException();
    }

    @Test
    void oneIpsLimit_doesNotBlockAnotherIp() {
        HttpServletRequest flooder = requestFrom("10.0.0.1");
        for (int i = 0; i < 10; i++) limiter.check(flooder);

        assertThatCode(() -> limiter.check(requestFrom("10.0.0.2"))).doesNotThrowAnyException();
    }

    // --- the leak: expired windows must not pile up forever ---

    @Test
    void expiredWindows_areSweptAwayInsteadOfAccumulating() {
        for (int i = 0; i < MAX_TRACKED_IPS; i++) {
            limiter.check(requestFrom("10.0.1." + i));
        }
        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_IPS);

        clock.advanceSeconds(61); // every window has elapsed; none of these IPs ever return
        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void aLiveWindowSurvivesTheSweep() {
        HttpServletRequest request = requestFrom("10.0.0.1");
        limiter.check(request);

        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isEqualTo(1);
    }

    @Test
    void burstOfDistinctIps_cannotGrowTheMapPastTheCap() {
        for (int i = 0; i < MAX_TRACKED_IPS * 5; i++) {
            limiter.check(requestFrom("10.1." + (i / 256) + "." + (i % 256)));
        }

        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_IPS);
    }

    @Test
    void anIpRefusedByTheCap_isStillServed_soAFloodCannotLockEveryoneOut() {
        for (int i = 0; i < MAX_TRACKED_IPS; i++) {
            limiter.check(requestFrom("10.0.1." + i));
        }

        // The map is full of live windows. A genuine new visitor must not be turned away.
        assertThatCode(() -> limiter.check(requestFrom("10.9.9.9"))).doesNotThrowAnyException();
    }
}
