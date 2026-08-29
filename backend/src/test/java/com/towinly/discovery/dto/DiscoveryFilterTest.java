package com.towinly.discovery.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SEC-07: whatever arrives in the query string, what the service reads back is bounded.
 * The filter is bound straight from the URL, so this is the boundary where the numbers
 * stop being the caller's choice.
 */
class DiscoveryFilterTest {

    @Test
    void anUntouchedFilterStillReadsBackTheOldDefaults() {
        DiscoveryFilter filter = new DiscoveryFilter();

        assertThat(filter.getSize()).isEqualTo(20);
        assertThat(filter.getPage()).isZero();
        assertThat(filter.getRadiusKm()).isEqualTo(10.0);
    }

    @Test
    void anOversizedPageComesBackAsTheServerMaximum() {
        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setSize(100_000);

        assertThat(filter.getSize()).isEqualTo(50);
    }

    @Test
    void aZeroOrNegativePageSizeComesBackAsTheDefault() {
        DiscoveryFilter zero = new DiscoveryFilter();
        zero.setSize(0);
        DiscoveryFilter negative = new DiscoveryFilter();
        negative.setSize(-5);

        assertThat(zero.getSize()).isEqualTo(20);
        assertThat(negative.getSize()).isEqualTo(20);
    }

    @Test
    void aNegativePageNumberComesBackAsTheFirstPage() {
        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setPage(-1);

        assertThat(filter.getPage()).isZero();
    }

    @Test
    void aHugeRadiusComesBackAsTheServerMaximum() {
        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setRadiusKm(100_000.0);

        assertThat(filter.getRadiusKm()).isEqualTo(100.0);
    }

    @Test
    void theWidestRadiusTheAppOffersSurvivesUntouched() {
        // Both clients top out at 100 km, so the cap must not narrow a real choice.
        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setRadiusKm(100.0);

        assertThat(filter.getRadiusKm()).isEqualTo(100.0);
    }

    @Test
    void aMissingOrNonsenseRadiusComesBackAsTheDefaultAndNeverNull() {
        DiscoveryFilter empty = new DiscoveryFilter();
        empty.setRadiusKm(null);          // "?radiusKm=" binds to null
        DiscoveryFilter nonsense = new DiscoveryFilter();
        nonsense.setRadiusKm(Double.NaN); // "?radiusKm=NaN" parses
        DiscoveryFilter zero = new DiscoveryFilter();
        zero.setRadiusKm(0.0);

        assertThat(empty.getRadiusKm()).isEqualTo(10.0);
        assertThat(nonsense.getRadiusKm()).isEqualTo(10.0);
        assertThat(zero.getRadiusKm()).isEqualTo(1.0);
    }
}
