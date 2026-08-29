package com.towinly.common.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SEC-01. The phone already snaps a fix to a 0.02 degree cell before sending
 * (App/src/lib/coarseLocation.js), but the server used to store whatever it was
 * given, so the website's raw browser fix and any other API client wrote a
 * precise home into a DECIMAL(10,8) column. A control that lives only in one
 * client is not a control, so the same grid is enforced here.
 *
 * The grid is what bounds the leak: /discover answers a distance from an origin
 * the caller chooses, so three calls solve for the stored point. When the stored
 * point IS a grid vertex, that is all three calls can ever recover: the ~2.2 km
 * cell, which is the privacy level the store answers describe.
 */
class CoarseLocationTest {

    @Test
    void snapsToTheSameGridThePhoneUses() {
        // 0.02 degrees, so two decimals is exactly the grid's resolution.
        assertThat(CoarseLocation.snap(45.4765)).isEqualByComparingTo(new BigDecimal("45.48"));
        assertThat(CoarseLocation.snap(-73.6127)).isEqualByComparingTo(new BigDecimal("-73.62"));
    }

    @Test
    void landsOnACleanTwoDecimalValue_notAFloatArtifact() {
        // Math.round(x / 0.02) * 0.02 lands on values like 45.480000000000004 in
        // binary floating point. The stored value must be the grid vertex itself.
        assertThat(CoarseLocation.snap(45.4765).scale()).isLessThanOrEqualTo(2);
        assertThat(CoarseLocation.snap(45.4765).toPlainString()).isEqualTo("45.48");
    }

    @Test
    void isIdempotent_soAnAlreadyCoarseFixIsNeverMovedAgain() {
        BigDecimal once = CoarseLocation.snap(45.4765);
        BigDecimal twice = CoarseLocation.snap(once.doubleValue());
        assertThat(twice).isEqualByComparingTo(once);
    }

    @Test
    void everyPointInsideOneCellCollapsesToTheSameVertex() {
        // The whole point: a street address and the house next door become one
        // value, so a distance oracle cannot tell them apart.
        BigDecimal a = CoarseLocation.snap(45.4712);
        BigDecimal b = CoarseLocation.snap(45.4788);
        assertThat(a).isEqualByComparingTo(b);
    }

    @Test
    void passesNullThrough_soNoLocationStaysNoLocation() {
        assertThat(CoarseLocation.snap((Double) null)).isNull();
        assertThat(CoarseLocation.snap((BigDecimal) null)).isNull();
    }

    @Test
    void refusesAnOutOfRangeReading() {
        // A bad reading never becomes a stored coordinate.
        assertThat(CoarseLocation.snap(91.0)).isNull();
        assertThat(CoarseLocation.snap(-90.5)).isNull();
        assertThat(CoarseLocation.snapLng(181.0)).isNull();
        assertThat(CoarseLocation.snapLng(-180.5)).isNull();
    }

    @Test
    void acceptsTheExactBounds() {
        assertThat(CoarseLocation.snap(90.0)).isNotNull();
        assertThat(CoarseLocation.snapLng(180.0)).isNotNull();
    }

    @Test
    void snapsABigDecimalTheSameWayAsADouble() {
        // The migration coarsens rows already stored; it must agree with the
        // write path or a re-save would move a point that was already correct.
        assertThat(CoarseLocation.snap(new BigDecimal("45.4765")))
                .isEqualByComparingTo(CoarseLocation.snap(45.4765));
    }
}
