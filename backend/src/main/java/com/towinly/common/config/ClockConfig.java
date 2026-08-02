package com.towinly.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * The app's source of "now", as a bean rather than a static call.
 *
 * Everywhere else in Towinly reads the wall clock directly, and that has been fine: a
 * message stamped a second late is a second late. The Sealed box is the first place where
 * time is a safety rule rather than a label — a reveal is refused for seven days after a
 * password change, and the cooling-off week is the only defence against a relative sitting
 * beside an elder and tapping through the whole setup in one visit.
 *
 * A rule that can only be tested by waiting a week is a rule that ships untested, and an
 * untested rule about irreversible disclosure must not ship at all. Injecting the clock is
 * what makes "the eighth day" an assertion instead of a hope.
 *
 * <p>Rate limiters already take a {@code Clock} through their own constructors and do not
 * need this bean; new services should take it as a constructor dependency.
 */
@Configuration
public class ClockConfig {

    /**
     * UTC on purpose. The stored timestamps are naive {@code TIMESTAMP} columns written by
     * the same JVM that reads them, so the only thing that matters is that one zone is used
     * consistently — and a fixed one cannot shift a freeze by an hour twice a year.
     */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
