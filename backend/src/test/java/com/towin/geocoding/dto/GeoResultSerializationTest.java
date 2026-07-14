package com.towin.geocoding.dto;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the Redis cache path (RedisConfig, app.redis.enabled=true). Redis stays
 * OFF by default to avoid hosting cost, so nothing exercises this at runtime —
 * but the cached values must still be able to round-trip through the serializer
 * Redis would use, or switching Redis on would break geocoding on day one.
 *
 * Spring's cache abstraction unwraps the Optional from forwardGeocode and stores
 * a bare GeoResult, so GeoResult is what actually hits the serializer.
 */
class GeoResultSerializationTest {

    private final RedisSerializer<Object> serializer = new GenericJackson2JsonRedisSerializer();

    @Test
    void geoResultSurvivesRedisJsonRoundTrip() {
        // Arrange
        GeoResult original = new GeoResult(45.5017, -73.5673, "Montreal");

        // Act
        Object restored = serializer.deserialize(serializer.serialize(original));

        // Assert
        assertThat(restored).isInstanceOf(GeoResult.class);
        GeoResult result = (GeoResult) restored;
        assertThat(result.getLat()).isEqualTo(45.5017);
        assertThat(result.getLng()).isEqualTo(-73.5673);
        assertThat(result.getCity()).isEqualTo("Montreal");
    }

    @Test
    void geoResultWithNoCitySurvivesRedisJsonRoundTrip() {
        // Nominatim can return coordinates with no display_name, so city is nullable.
        GeoResult original = new GeoResult(51.5074, -0.1278, null);

        Object restored = serializer.deserialize(serializer.serialize(original));

        assertThat(restored).isEqualTo(original);
    }

    @Test
    void reverseGeocodeCacheValueSurvivesRedisJsonRoundTrip() {
        // reverseGeocode caches a plain String, which the serializer handles
        // natively — this pins that down so the reverse cache can't regress into
        // a DTO without a no-arg constructor.
        Object restored = serializer.deserialize(serializer.serialize("Montreal"));

        assertThat(restored).isEqualTo("Montreal");
    }
}
