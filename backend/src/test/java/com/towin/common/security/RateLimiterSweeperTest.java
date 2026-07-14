package com.towin.common.security;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class RateLimiterSweeperTest {

    @Test
    void sweep_dropsExpiredEntriesFromEveryRegisteredLimiter() {
        SweepableRateLimiter first = mock(SweepableRateLimiter.class);
        SweepableRateLimiter second = mock(SweepableRateLimiter.class);
        RateLimiterSweeper sweeper = new RateLimiterSweeper(List.of(first, second));

        sweeper.sweepExpiredEntries();

        verify(first).sweepExpired();
        verify(second).sweepExpired();
    }

    @Test
    void sweep_isSafeWhenNoLimitersAreRegistered() {
        RateLimiterSweeper sweeper = new RateLimiterSweeper(List.of());

        sweeper.sweepExpiredEntries(); // must not blow up the scheduler thread
    }
}
