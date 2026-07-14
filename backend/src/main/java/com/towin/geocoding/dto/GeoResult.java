package com.towin.geocoding.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Cached value of GeocodingService.forwardGeocode — Spring's cache abstraction
 * unwraps the Optional and stores this bare. @NoArgsConstructor is what lets
 * Jackson rebuild it, so the Redis cache path (app.redis.enabled=true) can
 * deserialize it instead of failing with "no Creators, like default constructor".
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GeoResult {
    private double lat;
    private double lng;
    private String city;
}
