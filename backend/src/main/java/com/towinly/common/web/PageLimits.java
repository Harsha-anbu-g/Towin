package com.towinly.common.web;

/**
 * SEC-07: how much of the directory one request may take.
 *
 * <p>Browse endpoints bind their page size and radius straight from the query
 * string. Left alone, {@code ?size=100000&radiusKm=100000} hands back every active
 * member in one response: name, age, city, bio, interests and a distance. On a
 * platform whose members are elderly people living alone, that list is the product's
 * most sensitive asset, so the numbers are the server's decision, not the caller's.
 *
 * <p>Values are clamped rather than rejected. Every client in use sends either
 * nothing or a value already inside these bounds, so a clamp changes nothing for
 * them, while a 400 would turn a harmless stale link into a broken screen. An API
 * consumer that asks for 100000 rows receives {@link #MAX_PAGE_SIZE} with no error.
 *
 * <p>The ceilings are set by what the clients actually offer, not by taste:
 * both the website's radius select and the app's RADIUS_STEPS top out at 100 km,
 * so a lower {@link #MAX_RADIUS_KM} would silently narrow a real choice.
 *
 * <p>Same shape as {@link com.towinly.common.geo.CoarseLocation}: one place for the
 * numbers, so two endpoints cannot drift apart.
 */
public final class PageLimits {

    /** Rows per page when the caller asks for nothing sensible. */
    public static final int DEFAULT_PAGE_SIZE = 20;

    /** The most rows any single browse response may carry. */
    public static final int MAX_PAGE_SIZE = 50;

    /** Search radius when none is supplied. */
    public static final double DEFAULT_RADIUS_KM = 10.0;

    /** A radius below this is meaningless against a 2.2 km location cell. */
    public static final double MIN_RADIUS_KM = 1.0;

    /** The widest radius either client offers. */
    public static final double MAX_RADIUS_KM = 100.0;

    private PageLimits() {
    }

    /** Rows to return: at most {@link #MAX_PAGE_SIZE}, and never zero or negative. */
    public static int size(int requested) {
        if (requested <= 0) return DEFAULT_PAGE_SIZE;
        return Math.min(requested, MAX_PAGE_SIZE);
    }

    /** Page number: never negative, because a negative skip throws. */
    public static int page(int requested) {
        return Math.max(requested, 0);
    }

    /**
     * Search radius in km, inside {@link #MIN_RADIUS_KM}..{@link #MAX_RADIUS_KM}.
     * A missing radius ({@code ?radiusKm=} binds to null) or a NaN one becomes the
     * default instead of reaching the comparison, where it used to be a 500 or an
     * empty screen.
     */
    public static double radiusKm(Double requested) {
        if (requested == null || Double.isNaN(requested)) return DEFAULT_RADIUS_KM;
        return Math.min(Math.max(requested, MIN_RADIUS_KM), MAX_RADIUS_KM);
    }
}
