package com.towinly.discovery.dto;

import lombok.Data;

/**
 * The query string behind GET /api/discover/elders and /helpers.
 *
 * SEC-07: page size and radius arrive straight from the caller, so they are
 * clamped here, at binding time, rather than in one service method. A cap that
 * lives on the DTO cannot be walked past by a future endpoint that forgets it.
 */
@Data
public class DiscoveryFilter {

    /**
     * The most profiles one discovery response will ever carry. Uncapped, a single
     * "?size=100000" read back the whole member directory (name, age, city, bio,
     * interests, photo) in one response. No client sends size at all today: both
     * dashboards use the default 20, so this leaves real screens ample room.
     */
    public static final int MAX_PAGE_SIZE = 50;

    /**
     * The widest search a caller may ask for. 100 km is exactly the largest option
     * the radius selector offers; if that list ever grows, this constant moves with it.
     */
    public static final double MAX_RADIUS_KM = 100.0;

    private Double lat;
    private Double lng;
    private Double radiusKm = 10.0;
    private String language;
    private String interest;
    private int page = 0;
    private int size = 20;

    /** Clamped into 1..{@link #MAX_PAGE_SIZE}. Zero or less would reach Stream.limit and throw. */
    public void setSize(int size) {
        this.size = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
    }

    /** Clamped to at most {@link #MAX_RADIUS_KM}. A null radius keeps the default. */
    public void setRadiusKm(Double radiusKm) {
        this.radiusKm = radiusKm == null ? this.radiusKm : Math.min(radiusKm, MAX_RADIUS_KM);
    }
}
