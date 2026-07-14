package com.towin.common.security;

/**
 * An in-memory rate limiter whose expired entries can be reclaimed. Implemented by
 * every limiter so {@link RateLimiterSweeper} can sweep them all on one schedule
 * instead of each limiter owning its own timer.
 */
public interface SweepableRateLimiter {

    /** Drops every entry whose window has already elapsed. */
    void sweepExpired();
}
