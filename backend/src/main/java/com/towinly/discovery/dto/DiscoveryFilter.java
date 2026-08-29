package com.towinly.discovery.dto;

import com.towinly.common.web.PageLimits;
import lombok.Data;

/**
 * The browse query, bound field by field from the URL.
 *
 * <p>SEC-07: the page size, the page number and the radius are read back clamped.
 * The getters do the clamping, not the setters, because the getter is the only read
 * path there is: the service, the cache key and any future caller all go through it,
 * so no binder and no {@code new DiscoveryFilter()} can slip past it. The raw value
 * stays in the field, so a log still shows what was actually asked for.
 */
@Data
public class DiscoveryFilter {
    private Double lat;
    private Double lng;
    private Double radiusKm = PageLimits.DEFAULT_RADIUS_KM;
    private String language;
    private String interest;
    private int page = 0;
    private int size = PageLimits.DEFAULT_PAGE_SIZE;

    /** Search radius in km, never null and never wider than the server allows. */
    public Double getRadiusKm() {
        return PageLimits.radiusKm(radiusKm);
    }

    /** Page number, never negative. */
    public int getPage() {
        return PageLimits.page(page);
    }

    /** Rows per page, never more than the server allows. */
    public int getSize() {
        return PageLimits.size(size);
    }
}
