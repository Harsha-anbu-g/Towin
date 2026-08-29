package com.towinly.common.geo;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * SEC-01: the server is as coarse as the phone.
 *
 * <p>The app snaps every fix to a 0.02 degree cell before it leaves the device
 * (App/src/lib/coarseLocation.js). Until now the server stored whatever it was sent
 * and answered distance queries to 100 m from a caller-chosen origin, so three
 * requests trilaterated any member's stored position. Everything about a
 * coordinate now goes through here:
 *
 * <ul>
 *   <li>{@link #snap} rounds a coordinate to the centre of its 0.02 degree cell
 *       (about 2.2 km north-south). Applied on every write and on both ends of every
 *       distance, so rows stored before this change are covered too.</li>
 *   <li>{@link #bandKm} turns a distance into a wide band (2, 5, 10, 20, 50, then
 *       steps of 50 km). Same cell reads 0.</li>
 *   <li>{@link #origin} picks the point a query measures from: the caller's supplied
 *       point, snapped, unless it drifts more than {@link #MAX_ORIGIN_DRIFT_KM} from
 *       the caller's own stored cell, in which case the stored cell is used and the
 *       supplied point is ignored. A person moves about a city; an origin sweep does not.</li>
 * </ul>
 *
 * Rounding is decimal and HALF_UP so a coordinate on a half cell lands on the same
 * cell every time; the phone's float {@code Math.round(v / 0.02)} cannot promise that.
 */
public final class CoarseLocation {

    /** Degrees per grid cell. Matches GRID_DEGREES in the app; do not change one without the other. */
    public static final BigDecimal GRID_DEGREES = new BigDecimal("0.02");

    /** A supplied origin farther than this from the caller's stored cell is ignored. */
    public static final double MAX_ORIGIN_DRIFT_KM = 50.0;

    private static final BigDecimal CELLS_PER_DEGREE = BigDecimal.ONE.divide(GRID_DEGREES); // 50
    private static final double[] BAND_EDGES_KM = {2.0, 5.0, 10.0, 20.0, 50.0};
    private static final double BAND_STEP_BEYOND_KM = 50.0;
    private static final double EARTH_RADIUS_KM = 6371.0;

    private CoarseLocation() {
    }

    /** Snap a coordinate to the centre of its cell, two decimals. */
    public static BigDecimal snap(double value) {
        return snap(BigDecimal.valueOf(value));
    }

    /** Snap a coordinate to the centre of its cell, two decimals; null stays null. */
    public static BigDecimal snap(BigDecimal value) {
        if (value == null) return null;
        return value.multiply(CELLS_PER_DEGREE)
                .setScale(0, RoundingMode.HALF_UP)
                .divide(CELLS_PER_DEGREE, 2, RoundingMode.HALF_UP);
    }

    /** Snap a boxed coordinate; null stays null. */
    public static BigDecimal snapOrNull(Double value) {
        return value == null ? null : snap(value);
    }

    /** A distance in wide bands: 0 for the same cell, then 2, 5, 10, 20, 50 and steps of 50 km. */
    public static double bandKm(double distanceKm) {
        if (distanceKm <= 0.0) return 0.0;
        for (double edge : BAND_EDGES_KM) {
            if (distanceKm <= edge) return edge;
        }
        return Math.ceil(distanceKm / BAND_STEP_BEYOND_KM) * BAND_STEP_BEYOND_KM;
    }

    /**
     * The origin a distance query measures from, as {lat, lng}, or null when neither a
     * usable supplied point nor a stored cell exists.
     */
    public static double[] origin(Double suppliedLat, Double suppliedLng,
                                  BigDecimal storedLat, BigDecimal storedLng) {
        boolean hasStored = storedLat != null && storedLng != null;
        double[] stored = hasStored
                ? new double[]{snap(storedLat).doubleValue(), snap(storedLng).doubleValue()}
                : null;
        if (suppliedLat == null || suppliedLng == null) return stored;

        double[] supplied = {snap(suppliedLat).doubleValue(), snap(suppliedLng).doubleValue()};
        if (!hasStored) return supplied;
        double drift = haversineKm(stored[0], stored[1], supplied[0], supplied[1]);
        return drift > MAX_ORIGIN_DRIFT_KM ? stored : supplied;
    }

    /** Great-circle distance in km between two points. */
    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
