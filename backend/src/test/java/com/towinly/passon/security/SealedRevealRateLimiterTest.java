package com.towinly.passon.security;

import com.towinly.common.exception.RateLimitException;
import com.towinly.common.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The guard in front of the Sealed box, held to the same policy as
 * {@link com.towinly.auth.security.LoginRateLimiter}: five wrong passwords, then fifteen
 * minutes, and a saturated store denies rather than waves through.
 *
 * The difference from login is the key. Whoever is guessing here is already signed in as the
 * elder — they picked up her unlocked phone, or they hold her mailbox — so the key is her
 * user id and not an address or an IP.
 */
class SealedRevealRateLimiterTest {

    private static final int MAX_TRACKED_KEYS = 100;

    private MutableClock clock;
    private SealedRevealRateLimiter limiter;
    private UUID margaret;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new SealedRevealRateLimiter(clock, MAX_TRACKED_KEYS);
        margaret = UUID.randomUUID();
    }

    @Test
    void fourWrongPasswordsDoNotLockHerOut() {
        for (int i = 0; i < 4; i++) limiter.recordFailure(margaret);

        assertThatCode(() -> limiter.checkNotLocked(margaret)).doesNotThrowAnyException();
    }

    @Test
    void theFifthWrongPasswordShutsTheBox() {
        for (int i = 0; i < 5; i++) limiter.recordFailure(margaret);

        assertThatThrownBy(() -> limiter.checkNotLocked(margaret))
                .isInstanceOf(RateLimitException.class)
                .hasMessage(SealedRevealRateLimiter.TOO_MANY_TRIES);
    }

    @Test
    void theLockLiftsAfterFifteenMinutes() {
        for (int i = 0; i < 5; i++) limiter.recordFailure(margaret);
        clock.advanceSeconds(Duration.ofMinutes(15).toSeconds() + 1);

        assertThatCode(() -> limiter.checkNotLocked(margaret)).doesNotThrowAnyException();
    }

    @Test
    void theRightPasswordClearsTheCount() {
        for (int i = 0; i < 4; i++) limiter.recordFailure(margaret);

        limiter.reset(margaret);

        assertThat(limiter.trackedKeys()).isZero();
    }

    @Test
    void oneOwnersLockoutDoesNotShutAnotherOwnersBox() {
        for (int i = 0; i < 5; i++) limiter.recordFailure(margaret);

        assertThatCode(() -> limiter.checkNotLocked(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void elapsedAttemptsAreSweptAwayInsteadOfAccumulating() {
        for (int i = 0; i < MAX_TRACKED_KEYS; i++) limiter.recordFailure(UUID.randomUUID());
        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_KEYS);

        clock.advanceSeconds(Duration.ofMinutes(15).toSeconds() + 1);
        limiter.sweepExpired();

        assertThat(limiter.trackedKeys()).isZero();
    }

    /**
     * Fail closed. A guard that lets untracked keys past can be switched off by flooding it,
     * and what is behind this one is a bank account number. The real owner is never stuck for
     * long: the right password clears her count.
     */
    @Test
    void aSaturatedStoreDeniesRatherThanWavesThrough() {
        for (int i = 0; i < MAX_TRACKED_KEYS * 5; i++) limiter.recordFailure(UUID.randomUUID());
        assertThat(limiter.trackedKeys()).isEqualTo(MAX_TRACKED_KEYS);

        assertThatThrownBy(() -> limiter.checkNotLocked(margaret))
                .isInstanceOf(RateLimitException.class)
                .hasMessage(SealedRevealRateLimiter.BUSY);
    }

    @Test
    void anUntrackedOwnerIsNotDeniedWhileThereIsRoom() {
        assertThatCode(() -> limiter.checkNotLocked(margaret)).doesNotThrowAnyException();
    }
}
