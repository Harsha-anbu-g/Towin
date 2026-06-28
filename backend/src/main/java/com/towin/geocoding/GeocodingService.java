package com.towin.geocoding;

import com.towin.geocoding.dto.GeoResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Turns coordinates into place names (reverse) and typed addresses into
 * coordinates (forward) using the public Nominatim/OpenStreetMap API.
 *
 * Nominatim's usage policy REQUIRES a descriptive User-Agent and a low request
 * rate, so all calls go through the backend (never the browser) and results are
 * cached. Any failure returns null/empty and is logged — geocoding must never
 * break a location save.
 */
@Slf4j
@Service
public class GeocodingService {

    private final RestClient client;
    private final String userAgent;

    // Spring constructor: builds a RestClient with short timeouts so a slow
    // Nominatim never holds up a user's location save.
    public GeocodingService(
            @Value("${nominatim.base-url:https://nominatim.openstreetmap.org}") String baseUrl,
            @Value("${nominatim.user-agent:ToWin/1.0 (agharsha.anbu@gmail.com)}") String userAgent) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.userAgent = userAgent;
    }

    // Test constructor: inject a mock RestClient directly.
    GeocodingService(RestClient client, String userAgent) {
        this.client = client;
        this.userAgent = userAgent;
    }

    @Cacheable(value = "geocode-reverse", key = "T(java.lang.Math).round(#lat*1000)+'-'+T(java.lang.Math).round(#lng*1000)")
    public String reverseGeocode(double lat, double lng) {
        try {
            Map<String, Object> body = client.get()
                    .uri("/reverse?format=jsonv2&lat={lat}&lon={lng}", lat, lng)
                    .header("User-Agent", userAgent)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            return cityFrom(body);
        } catch (Exception e) {
            log.warn("Reverse geocode failed for {},{}: {}", lat, lng, e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private String cityFrom(Map<String, Object> body) {
        if (body == null) return null;
        Object addr = body.get("address");
        if (addr instanceof Map<?, ?> a) {
            for (String key : List.of("city", "town", "village", "suburb")) {
                Object v = ((Map<String, Object>) a).get(key);
                if (v != null) return v.toString();
            }
        }
        Object display = body.get("display_name");
        if (display != null) {
            String first = display.toString().split(",")[0].trim();
            return first.isEmpty() ? null : first;
        }
        return null;
    }
}
