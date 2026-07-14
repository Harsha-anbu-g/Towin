package com.towin.common.security;

import com.towin.common.support.MutableClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class ExpiringKeyStoreTest {

    private static final int MAX_ENTRIES = 100;

    /** A minimal entry: alive until {@code expiresAt}, exactly like a limiter window. */
    private record Entry(Instant expiresAt) {}

    private MutableClock clock;
    private ExpiringKeyStore<String, Entry> store;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        store = new ExpiringKeyStore<>(Entry::expiresAt, clock, MAX_ENTRIES);
    }

    private Entry livingFor(long seconds) {
        return new Entry(clock.instant().plusSeconds(seconds));
    }

    private void fillToCapacity() {
        for (int i = 0; i < MAX_ENTRIES; i++) {
            store.compute("key-" + i, (k, existing) -> livingFor(60));
        }
    }

    @Test
    void sweep_dropsExpiredEntriesAndKeepsLiveOnes() {
        store.compute("short", (k, existing) -> livingFor(60));
        store.compute("long", (k, existing) -> livingFor(600));

        clock.advanceSeconds(61);
        store.sweep();

        assertThat(store.size()).isEqualTo(1);
        assertThat(store.get("short")).isNull();
        assertThat(store.get("long")).isNotNull();
    }

    @Test
    void sweep_shrinksTheStore_ratherThanAccumulatingKeysThatNeverComeBack() {
        fillToCapacity();
        assertThat(store.size()).isEqualTo(MAX_ENTRIES);

        clock.advanceSeconds(61);
        store.sweep();

        assertThat(store.size()).isZero();
    }

    @Test
    void expiredEntry_readsAsAbsent() {
        store.compute("key", (k, existing) -> livingFor(60));
        clock.advanceSeconds(61);

        assertThat(store.get("key")).isNull();
    }

    @Test
    void computeSeesAnExpiredEntryAsAbsent_soTheWindowStartsFresh() {
        store.compute("key", (k, existing) -> livingFor(60));
        clock.advanceSeconds(61);

        AtomicBoolean sawExisting = new AtomicBoolean(true);
        store.compute("key", (k, existing) -> {
            sawExisting.set(existing != null);
            return livingFor(60);
        });

        assertThat(sawExisting).isFalse();
    }

    @Test
    void burstOfDistinctKeys_cannotGrowTheStorePastTheCap() {
        for (int i = 0; i < MAX_ENTRIES * 10; i++) {
            store.compute("key-" + i, (k, existing) -> livingFor(60));
        }

        assertThat(store.size()).isEqualTo(MAX_ENTRIES);
    }

    @Test
    void atCapacity_aNewKeyIsRefused_butKnownKeysStillCount() {
        fillToCapacity();

        assertThat(store.compute("brand-new", (k, existing) -> livingFor(60))).isNull();
        assertThat(store.get("brand-new")).isNull();
        assertThat(store.compute("key-0", (k, existing) -> livingFor(60))).isNotNull();
    }

    @Test
    void atCapacity_expiredEntriesAreReclaimedOnWrite_soNewKeysAreTrackedAgain() {
        fillToCapacity();
        clock.advanceSeconds(61); // every window has now elapsed

        assertThat(store.compute("fresh", (k, existing) -> livingFor(60))).isNotNull();
        assertThat(store.size()).isEqualTo(1);
    }

    @Test
    void remove_dropsTheEntry() {
        store.compute("key", (k, existing) -> livingFor(60));

        store.remove("key");

        assertThat(store.size()).isZero();
    }
}
