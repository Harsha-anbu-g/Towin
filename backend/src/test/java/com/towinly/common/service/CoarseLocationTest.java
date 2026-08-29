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

    @Test
    void agreesWithTheMigrationsSqlOnAnExactHalfCell_includingNegativeLongitudes() {
        // V59 coarsens the rows already stored, so its arithmetic has to land on
        // the same vertex this class does or a migrated row and a re-saved row sit
        // a full cell apart. The trap is the half: Java's Math.round goes toward
        // positive infinity, Postgres ROUND() goes away from zero, and they part
        // company on exactly the negative half cells this app's longitudes live
        // on. V59 therefore uses FLOOR(x + 0.5), which is Math.round's definition,
        // and this test is what says so out loud.
        for (double v : new double[]{-73.61, -0.01, -45.47, 45.47, 73.61, -73.63}) {
            assertThat(CoarseLocation.snap(v))
                    .as("grid vertex for %s", v)
                    .isEqualByComparingTo(sqlFloorHalfUp(v));
        }
    }

    @Test
    void theOldAwayFromZeroRoundingWouldHaveMissedByAWholeCell() {
        // Proof that the test above has teeth. A plain ROUND() in Postgres rounds
        // -73.61 away from zero to -73.62, while the application stores -73.60:
        // one cell apart, about 1.6 km at this latitude, silently.
        assertThat(sqlAwayFromZero(-73.61)).isNotEqualByComparingTo(CoarseLocation.snap(-73.61));
        // And they still agree wherever the half does not fall at a negative value.
        assertThat(sqlAwayFromZero(45.47)).isEqualByComparingTo(CoarseLocation.snap(45.47));
    }

    /** What V59 computes: ROUND(FLOOR(x / 0.02 + 0.5) * 0.02, 2). */
    private static BigDecimal sqlFloorHalfUp(double v) {
        double cells = Math.floor(v / CoarseLocation.GRID_DEGREES + 0.5);
        return BigDecimal.valueOf(cells * CoarseLocation.GRID_DEGREES)
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /** What a plain Postgres ROUND() would compute: half away from zero. */
    private static BigDecimal sqlAwayFromZero(double v) {
        return BigDecimal.valueOf(v / CoarseLocation.GRID_DEGREES)
                .setScale(0, java.math.RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(CoarseLocation.GRID_DEGREES))
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
