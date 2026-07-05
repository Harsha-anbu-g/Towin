package com.towin.geocoding;

import com.towin.geocoding.dto.GeoResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Turns coordinates into place names (reverse) and typed addresses into
 * coordinates (forward) using the public Nominatim/OpenStreetMap API, with
 * Zippopotam.us handling postal codes (see postcodeLookup for why).
 *
 * Nominatim's usage policy REQUIRES a descriptive User-Agent and a low request
 * rate, so all calls go through the backend (never the browser) and results are
 * cached. Any failure returns null/empty and is logged — geocoding must never
 * break a location save.
 */
@Slf4j
@Service
public class GeocodingService {

    // Canadian postcode (H3H 1H4, h3h1h4, M1B) or a US zip (10001, 90210-1234),
    // matched after stripping spaces and uppercasing.
    private static final Pattern CA_POSTCODE = Pattern.compile("[A-Z]\\d[A-Z](\\d[A-Z]\\d)?");
    private static final Pattern US_ZIP = Pattern.compile("\\d{5}(-\\d{4})?");

    private final RestClient client;
    private final RestClient postcodeClient;
    private final String userAgent;

    // Spring constructor: builds RestClients with short timeouts so a slow
    // geocoder never holds up a user's location save. @Autowired disambiguates
    // it from the package-private test constructor below.
    @Autowired
    public GeocodingService(
            @Value("${nominatim.base-url:https://nominatim.openstreetmap.org}") String baseUrl,
            @Value("${nominatim.user-agent:ToWin/1.0 (agharsha.anbu@gmail.com)}") String userAgent,
            @Value("${zippopotam.base-url:https://api.zippopotam.us}") String zippopotamBaseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.postcodeClient = RestClient.builder().baseUrl(zippopotamBaseUrl).requestFactory(factory).build();
        this.userAgent = userAgent;
    }

    // Test constructor: inject a mock RestClient (shared by both geocoders).
    GeocodingService(RestClient client, String userAgent) {
        this.client = client;
        this.postcodeClient = client;
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

    @Cacheable(value = "geocode-forward", key = "#query == null ? '' : #query.trim().toLowerCase()")
    public Optional<GeoResult> forwardGeocode(String query) {
        if (query == null || query.isBlank()) return Optional.empty();
        String q = query.trim();
        Optional<GeoResult> postcodeHit = postcodeLookup(q);
        if (postcodeHit.isPresent()) return postcodeHit;
        try {
            List<Map<String, Object>> hits = client.get()
                    .uri("/search?format=jsonv2&limit=1&q={q}", q)
                    .header("User-Agent", userAgent)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            if (hits == null || hits.isEmpty()) return Optional.empty();
            Map<String, Object> top = hits.get(0);
            double lat = Double.parseDouble(top.get("lat").toString());
            double lng = Double.parseDouble(top.get("lon").toString());
            String city = null;
            Object display = top.get("display_name");
            if (display != null) city = display.toString().split(",")[0].trim();
            return Optional.of(new GeoResult(lat, lng, city));
        } catch (Exception e) {
            log.warn("Forward geocode failed for '{}': {}", query, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Postal codes need a dedicated geocoder: OSM barely maps full Canadian
     * postcodes (so Nominatim 404s on "H3H 1H4" in any spelling), and a bare
     * numeric zip like "10001" exists in dozens of countries, so free-form
     * search returns whichever ranks first worldwide — often the wrong
     * continent. Zippopotam.us resolves US zips directly and Canadian codes at
     * the forward-sortation-area level (first 3 characters — neighbourhood
     * accuracy, which is all any free geocoder has for Canada). Anything it
     * can't resolve falls through to the normal Nominatim search.
     */
    private Optional<GeoResult> postcodeLookup(String query) {
        String compact = query.replaceAll("\\s+", "").toUpperCase();
        String path;
        if (CA_POSTCODE.matcher(compact).matches()) {
            path = "/ca/" + compact.substring(0, 3);
        } else if (US_ZIP.matcher(compact).matches()) {
            path = "/us/" + compact.substring(0, 5);
        } else {
            return Optional.empty();
        }
        try {
            Map<String, Object> body = postcodeClient.get()
                    .uri(path)
                    .header("User-Agent", userAgent)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            if (body == null || !(body.get("places") instanceof List<?> places) || places.isEmpty()) {
                return Optional.empty();
            }
            if (!(places.get(0) instanceof Map<?, ?> place)) return Optional.empty();
            double lat = Double.parseDouble(place.get("latitude").toString());
            double lng = Double.parseDouble(place.get("longitude").toString());
            Object name = place.get("place name");
            return Optional.of(new GeoResult(lat, lng, name == null ? null : name.toString()));
        } catch (Exception e) {
            log.warn("Postcode lookup failed for '{}': {}", query, e.getMessage());
            return Optional.empty();
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
