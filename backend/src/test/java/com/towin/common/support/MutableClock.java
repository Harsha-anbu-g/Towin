package com.towin.common.support;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** A clock a test can move forward, so windows, cooldowns and sweeps are exercised for real. */
public final class MutableClock extends Clock {

    private Instant now = Instant.parse("2026-07-12T12:00:00Z");

    public void advanceSeconds(long seconds) { now = now.plusSeconds(seconds); }

    @Override public ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(ZoneId zone) { return this; }
    @Override public Instant instant() { return now; }
}
