package com.towinly.common.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Snaps a coordinate to a 0.02 degree cell, about 2.2 km, before it is stored.
 *
 * <p>Why this lives on the server (SEC-01, 2026-08-29). The phone has always
 * coarsened a fix before sending it (App/src/lib/coarseLocation.js), but
 * {@code PUT /profile/location} stored whatever arrived, and the website sends
 * {@code pos.coords.latitude} straight from the browser into a
 * {@code DECIMAL(10,8)} column. A control that lives in one client is not a
 * control: every other caller wrote a precise home.
 *
 * <p>What the grid buys. {@code /discover} and {@code /needs/nearby} answer with
 * a distance measured from an origin the caller supplies, so three calls from
 * chosen origins solve for the stored point. That cannot be fixed by hiding the
 * distance, because a marketplace has to say how far away someone is. It is
 * fixed by making the stored point coarse: when the point IS a grid vertex,
 * trilateration recovers the vertex and nothing finer. The answer is the ~2.2 km
 * cell, which is what the App Store and Play answers describe.
 *
 * <p>Two people in one cell therefore read 0 km apart. That is the rounding
 * doing its job, not a bug.
 *
 * <p>The grid and the two-decimal result match the phone's exactly, so a
 * coordinate that arrives already snapped is never moved again.
 */
public final class CoarseLocation {

    /** Degrees per grid cell. Do not raise: the store answers quote this size. */
    public static final double GRID_DEGREES = 0.02;

    /**
     * Two decimals is exactly the grid's resolution. Rounding to it also keeps
     * the stored value off binary-float artifacts such as 45.480000000000004,
     * so the value in the column is the grid vertex itself.
     */
    private static final int GRID_SCALE = 2;

    private CoarseLocation() {
    }

    /** Snaps a latitude. Returns null for a missing or out-of-range reading. */
    public static BigDecimal snap(Double value) {
        return snapWithin(value, 90.0);
    }

    /** Snaps a longitude. Returns null for a missing or out-of-range reading. */
    public static BigDecimal snapLng(Double value) {
        return snapWithin(value, 180.0);
    }

    /** Snaps a latitude already held as a BigDecimal (the migration's path). */
    public static BigDecimal snap(BigDecimal value) {
        return value == null ? null : snap(value.doubleValue());
    }

    /** Snaps a longitude already held as a BigDecimal. */
    public static BigDecimal snapLng(BigDecimal value) {
        return value == null ? null : snapLng(value.doubleValue());
    }

    private static BigDecimal snapWithin(Double value, double limit) {
        if (value == null || !Double.isFinite(value)) return null;
        // An out-of-range reading is refused rather than clamped: a clamped
        // coordinate is a confident lie, and the entity's own bounds would
        // reject it anyway.
        if (value < -limit || value > limit) return null;
        double snapped = Math.round(value / GRID_DEGREES) * GRID_DEGREES;
        return BigDecimal.valueOf(snapped).setScale(GRID_SCALE, RoundingMode.HALF_UP);
    }
}
