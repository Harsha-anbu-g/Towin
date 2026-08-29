package com.towinly.common.web;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** SEC-07: the numbers that decide how much of the directory one request can take. */
class PageLimitsTest {

    @Test
    void theScrapingPageSizeComesBackAsTheMaximum() {
        assertThat(PageLimits.size(100_000)).isEqualTo(50);
    }

    @Test
    void anOrdinaryPageSizeIsLeftAlone() {
        assertThat(PageLimits.size(20)).isEqualTo(20);
        assertThat(PageLimits.size(50)).isEqualTo(50);
    }

    @Test
    void zeroOrNegativePageSizeComesBackAsTheDefault() {
        assertThat(PageLimits.size(0)).isEqualTo(20);
        assertThat(PageLimits.size(-1)).isEqualTo(20);
    }

    @Test
    void aNegativePageComesBackAsTheFirstPage() {
        assertThat(PageLimits.page(-1)).isZero();
        assertThat(PageLimits.page(3)).isEqualTo(3);
    }

    @Test
    void aHugeRadiusIsCappedAndATinyOneIsFloored() {
        assertThat(PageLimits.radiusKm(100_000.0)).isEqualTo(100.0);
        assertThat(PageLimits.radiusKm(Double.POSITIVE_INFINITY)).isEqualTo(100.0);
        assertThat(PageLimits.radiusKm(0.0)).isEqualTo(1.0);
        assertThat(PageLimits.radiusKm(-40.0)).isEqualTo(1.0);
    }

    @Test
    void aMissingOrNonsenseRadiusComesBackAsTheDefault() {
        assertThat(PageLimits.radiusKm(null)).isEqualTo(10.0);
        assertThat(PageLimits.radiusKm(Double.NaN)).isEqualTo(10.0);
    }

    @Test
    void theWidestRadiusBothClientsOfferSurvivesUntouched() {
        // Website select and the app's RADIUS_STEPS both end at 100 km.
        assertThat(PageLimits.radiusKm(100.0)).isEqualTo(100.0);
        assertThat(PageLimits.radiusKm(25.0)).isEqualTo(25.0);
    }
}
