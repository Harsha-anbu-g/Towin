package com.towinly.common.geo;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SEC-01: the server must be as coarse as the phone. Every stored coordinate lands on the
 * 0.02 degree cell the app already uses (App/src/lib/coarseLocation.js), and a distance
 * leaves the server in a wide band, never as a 100 m float.
 */
class CoarseLocationTest {

    @Test
    void snap_landsOnTheCellCentreWithTwoDecimals() {
        assertThat(CoarseLocation.snap(45.4823)).isEqualByComparingTo("45.48");
        assertThat(CoarseLocation.snap(-73.5674)).isEqualByComparingTo("-73.56");
        assertThat(CoarseLocation.snap(13.0)).isEqualByComparingTo("13.00");
        assertThat(CoarseLocation.snap(45.4823).scale()).isEqualTo(2);
    }

    @Test
    void snap_isDeterministicOnAHalfCell_becauseAPhoneFloatIsNot() {
        // 13.01 / 0.02 is exactly 650.5 in decimal but 650.4999… as a double.
        assertThat(CoarseLocation.snap(13.01)).isEqualByComparingTo("13.02");
        assertThat(CoarseLocation.snap(new BigDecimal("13.03"))).isEqualByComparingTo("13.04");
    }

    @Test
    void snap_passesNullThrough() {
        assertThat(CoarseLocation.snap((BigDecimal) null)).isNull();
        assertThat(CoarseLocation.snapOrNull(null)).isNull();
    }

    @Test
    void bandKm_returnsWideBandsNotAFloat() {
        assertThat(CoarseLocation.bandKm(0.0)).isEqualTo(0.0);
        assertThat(CoarseLocation.bandKm(0.7)).isEqualTo(2.0);
        assertThat(CoarseLocation.bandKm(2.0)).isEqualTo(2.0);
        assertThat(CoarseLocation.bandKm(2.226)).isEqualTo(5.0);
        assertThat(CoarseLocation.bandKm(7.4)).isEqualTo(10.0);
        assertThat(CoarseLocation.bandKm(15.0)).isEqualTo(20.0);
        assertThat(CoarseLocation.bandKm(40.0)).isEqualTo(50.0);
        assertThat(CoarseLocation.bandKm(120.0)).isEqualTo(150.0);
    }

    @Test
    void haversineKm_oneCellOfLatitudeIsAboutTwoPointTwoKm() {
        assertThat(CoarseLocation.haversineKm(13.0, 80.0, 13.02, 80.0)).isBetween(2.2, 2.3);
    }

    @Test
    void origin_usesTheSuppliedPointSnappedWhenItSitsNearTheStoredCell() {
        double[] o = CoarseLocation.origin(13.009, 80.009, new BigDecimal("13.00"), new BigDecimal("80.00"));
        assertThat(o).containsExactly(13.0, 80.0);
    }

    @Test
    void origin_ignoresASuppliedPointThatDriftsTooFarFromTheStoredCell() {
        double[] o = CoarseLocation.origin(14.0, 80.0, new BigDecimal("13.00"), new BigDecimal("80.00"));
        assertThat(o).containsExactly(13.0, 80.0);
    }

    @Test
    void origin_acceptsTheSuppliedPointWhenNothingIsStored() {
        double[] o = CoarseLocation.origin(14.011, 80.0, null, null);
        assertThat(o).containsExactly(14.02, 80.0);
    }

    @Test
    void origin_fallsBackToTheStoredCellAndThenToNothing() {
        assertThat(CoarseLocation.origin(null, null, new BigDecimal("13.00"), new BigDecimal("80.00")))
                .containsExactly(13.0, 80.0);
        assertThat(CoarseLocation.origin(null, null, null, null)).isNull();
    }
}
