package com.towinly.discovery.service;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.S3Service;
import com.towinly.common.service.TrustScoreService;
import com.towinly.common.seed.DemoDataSeeder;
import com.towinly.discovery.dto.DiscoveredUserResponse;
import com.towinly.discovery.dto.DiscoveryFilter;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.block.service.BlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiscoveryService {

    /**
     * The distance sent when the caller has no location of their own, so nothing was
     * measured. It stays 0.0 rather than becoming a null: both clients read a 0 as
     * "no distance to show" and print the city alone, and a null would have to be
     * taught to software already on people's phones.
     */
    private static final double DISTANCE_NOT_MEASURED_KM = 0.0;

    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final UserRepository userRepository;
    private final TrustScoreService trustScoreService;
    private final S3Service s3Service;
    private final BlockService blockService;

    // SEC-07 completion: the size is part of the key — two differently-sized
    // requests are two different responses and must never share one cache entry.
    @Cacheable(value = "discovery-elders", key = "#requestingUserId + '-' + #filter.lat + '-' + #filter.lng + '-' + #filter.radiusKm + '-' + #filter.language + '-' + #filter.interest + '-' + #filter.page + '-' + #filter.size")
    public List<DiscoveredUserResponse> discoverElders(UUID requestingUserId, DiscoveryFilter filter) {
        User requester = getUser(requestingUserId);
        double lat = resolvedLat(filter, requester);
        double lng = resolvedLng(filter, requester);

        // HARD-106: a block in either direction removes the person here, before ranking.
        Set<UUID> hidden = blockService.hiddenFor(requestingUserId);
        // SEC-07 completion: the database ships only the box around the search radius,
        // not every active profile. The box encloses the radius circle, so the ranking
        // and the radius cut below see exactly the rows they always did.
        List<Map.Entry<ElderProfile, Double>> withinRadius =
                rankElders(eldersNear(requestingUserId, lat, lng, filter.getRadiusKm()),
                        hidden, filter, lat, lng).stream()
                .filter(e -> e.getValue() <= filter.getRadiusKm())
                .collect(Collectors.toList());

        List<Map.Entry<ElderProfile, Double>> visible = withinRadius;
        if (withinRadius.isEmpty() && isDemoAccount(requester)) {
            // The demo fallback ignores the radius, so it ranks the whole directory.
            visible = rankElders(elderProfileRepository.findAllActiveWithLocation(requestingUserId),
                    hidden, filter, lat, lng);
        }
        return visible.stream()
                .skip((long) filter.getPage() * filter.getSize())
                .limit(filter.getSize())
                .map(e -> toElderResponse(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    private List<Map.Entry<ElderProfile, Double>> rankElders(List<ElderProfile> candidates,
            Set<UUID> hidden, DiscoveryFilter filter, double lat, double lng) {
        return candidates.stream()
                .filter(p -> !hidden.contains(p.getUser().getId()))
                .filter(p -> matchesLanguage(filter, p.getLanguages()))
                .filter(p -> matchesInterest(filter, p.getInterests()))
                // R2-DISC: the query guards the latitude only, and the location endpoint
                // accepts a latitude without a longitude. Half a coordinate cannot be
                // measured from, and used to throw here - blanking the screen for everyone.
                .filter(p -> hasStoredCell(p.getUser()))
                .map(p -> Map.entry(p, cellDistanceKm(lat, lng, p.getUser())))
                .sorted(Comparator.comparingDouble(Map.Entry::getValue))
                .collect(Collectors.toList());
    }

    private List<ElderProfile> eldersNear(UUID requesterId, double lat, double lng, double radiusKm) {
        BoundingBox box = BoundingBox.around(lat, lng, radiusKm);
        if (box == null) {
            return elderProfileRepository.findAllActiveWithLocation(requesterId);
        }
        return elderProfileRepository.findAllActiveWithLocationInBox(requesterId,
                box.minLat(), box.maxLat(), box.minLng(), box.maxLng());
    }

    @Cacheable(value = "discovery-helpers", key = "#requestingUserId + '-' + #filter.lat + '-' + #filter.lng + '-' + #filter.radiusKm + '-' + #filter.language + '-' + #filter.page + '-' + #filter.size")
    public List<DiscoveredUserResponse> discoverHelpers(UUID requestingUserId, DiscoveryFilter filter) {
        User requester = getUser(requestingUserId);
        // Deliberate: a caller who has no location of their own still gets helpers,
        // measured against nothing, rather than an error screen.
        Double lat = resolvedLatOptional(filter, requester);
        Double lng = resolvedLngOptional(filter, requester);
        boolean hasLocation = lat != null && lng != null;

        Set<UUID> hidden = blockService.hiddenFor(requestingUserId);
        List<Map.Entry<HelperProfile, Double>> withinRadius =
                rankHelpers(helpersNear(requestingUserId, lat, lng, filter.getRadiusKm(), hasLocation),
                        hidden, filter, lat, lng, hasLocation).stream()
                .filter(e -> !hasLocation || e.getValue() <= filter.getRadiusKm())
                .collect(Collectors.toList());

        List<Map.Entry<HelperProfile, Double>> visible = withinRadius;
        if (withinRadius.isEmpty() && isDemoAccount(requester)) {
            visible = rankHelpers(helperProfileRepository.findAllActiveWithLocation(requestingUserId),
                    hidden, filter, lat, lng, hasLocation);
        }
        return visible.stream()
                .skip((long) filter.getPage() * filter.getSize())
                .limit(filter.getSize())
                .map(e -> toHelperResponse(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    private List<Map.Entry<HelperProfile, Double>> rankHelpers(List<HelperProfile> candidates,
            Set<UUID> hidden, DiscoveryFilter filter, Double lat, Double lng, boolean hasLocation) {
        return candidates.stream()
                .filter(p -> !hidden.contains(p.getUser().getId()))
                .filter(p -> matchesLanguage(filter, p.getLanguages()))
                // R2-DISC: someone we cannot place is left out instead of being handed a
                // distance of nought. That nought was a false claim of being next door, it
                // sorted them above every real neighbour, and because 0 is inside every
                // ceiling it walked straight through the radius SEC-07 clamped.
                .filter(p -> hasStoredCell(p.getUser()))
                .map(p -> Map.entry(p, hasLocation
                        ? cellDistanceKm(lat, lng, p.getUser())
                        : DISTANCE_NOT_MEASURED_KM))
                .sorted(Comparator.comparingDouble(Map.Entry::getValue))
                .collect(Collectors.toList());
    }

    private List<HelperProfile> helpersNear(UUID requesterId, Double lat, Double lng,
            double radiusKm, boolean hasLocation) {
        BoundingBox box = hasLocation ? BoundingBox.around(lat, lng, radiusKm) : null;
        if (box == null) {
            // No origin means no radius cut below either — every placed helper shows.
            return helperProfileRepository.findAllActiveWithLocation(requesterId);
        }
        return helperProfileRepository.findAllActiveWithLocationInBox(requesterId,
                box.minLat(), box.maxLat(), box.minLng(), box.maxLng());
    }

    /**
     * A latitude/longitude box that encloses the circle of {@code radiusKm} around a
     * point, under the same spherical model {@link #haversineKm} measures with
     * (1° of latitude = ~111.195 km). Padded 1% so a float rounding at the rim can
     * never cut a row the radius filter would have kept. Near the poles or across
     * the antimeridian a simple BETWEEN box stops being right — {@code around}
     * returns null there and the caller falls back to the unbounded read.
     */
    record BoundingBox(java.math.BigDecimal minLat, java.math.BigDecimal maxLat,
                       java.math.BigDecimal minLng, java.math.BigDecimal maxLng) {
        private static final double KM_PER_DEGREE = Math.PI / 180.0 * 6371.0; // ≈ 111.195
        private static final double PADDING = 1.01;

        static BoundingBox around(double lat, double lng, double radiusKm) {
            double latDelta = radiusKm / KM_PER_DEGREE * PADDING;
            double edgeLat = Math.min(Math.abs(lat) + latDelta, 90.0);
            if (edgeLat >= 89.0) return null; // cos() → 0: the box degenerates
            double lngDelta = radiusKm / (KM_PER_DEGREE * Math.cos(Math.toRadians(edgeLat))) * PADDING;
            if (lng - lngDelta < -180.0 || lng + lngDelta > 180.0) return null; // antimeridian
            return new BoundingBox(
                    java.math.BigDecimal.valueOf(lat - latDelta),
                    java.math.BigDecimal.valueOf(lat + latDelta),
                    java.math.BigDecimal.valueOf(lng - lngDelta),
                    java.math.BigDecimal.valueOf(lng + lngDelta));
        }
    }

    private DiscoveredUserResponse toElderResponse(ElderProfile p, double distanceKm) {
        int score = p.getUser().getTrustScore() != null ? (int) Math.round(p.getUser().getTrustScore()) : 0;
        return DiscoveredUserResponse.builder()
                .userId(p.getUser().getId())
                .name(p.getName())
                .age(p.getAge())
                .photoUrl(s3Service.presignedUrl(p.getPhotoUrl()))
                .bio(p.getBio())
                .interests(p.getInterests() != null ? Arrays.asList(p.getInterests()) : List.of())
                .languages(p.getLanguages() != null ? Arrays.asList(p.getLanguages()) : List.of())
                .city(p.getUser().getCity())
                .trustScore(score)
                .trustTier(TrustScoreService.tierFor(score))
                .distanceKm(Math.round(distanceKm * 10.0) / 10.0)
                .build();
    }

    private DiscoveredUserResponse toHelperResponse(HelperProfile p, double distanceKm) {
        int score = p.getUser().getTrustScore() != null ? (int) Math.round(p.getUser().getTrustScore()) : 0;
        return DiscoveredUserResponse.builder()
                .userId(p.getUser().getId())
                .name(p.getName())
                .age(p.getAge())
                .photoUrl(s3Service.presignedUrl(p.getPhotoUrl()))
                .bio(p.getBio())
                .interests(p.getHobbies() != null ? Arrays.asList(p.getHobbies()) : List.of())
                .languages(p.getLanguages() != null ? Arrays.asList(p.getLanguages()) : List.of())
                .skillsOffered(p.getSkillsOffered() != null ? Arrays.asList(p.getSkillsOffered()) : List.of())
                .city(p.getUser().getCity())
                .trustScore(score)
                .trustTier(TrustScoreService.tierFor(score))
                .distanceKm(Math.round(distanceKm * 10.0) / 10.0)
                .build();
    }

    /**
     * True when both halves of this person's cell are stored, so a distance to them
     * can actually be measured. Anything less is not a location, and treating it as
     * one is how a person ends up shown as 0 km from an elder they have never met.
     */
    private static boolean hasStoredCell(User person) {
        return person.getLocationLat() != null && person.getLocationLng() != null;
    }

    /**
     * Distance from the origin to the person's stored cell. SEC-01 snaps every
     * coordinate on write and the migration re-snapped old rows, so the stored
     * value is already a grid vertex.
     */
    private double cellDistanceKm(double lat, double lng, User person) {
        return haversineKm(lat, lng,
                person.getLocationLat().doubleValue(),
                person.getLocationLng().doubleValue());
    }

    /**
     * Sample/demo accounts must never show an empty list — a barren demo looks
     * broken. When nobody is within the requested radius, the discover methods fall
     * back to ranking the whole directory (radius ignored) for a demo seat, so
     * there's always something to explore. Real accounts stay strict.
     */
    private boolean isDemoAccount(User user) {
        return user.getEmail() != null && DemoDataSeeder.DEMO_EMAILS.contains(user.getEmail());
    }

    private boolean matchesLanguage(DiscoveryFilter filter, String[] languages) {
        if (filter.getLanguage() == null || languages == null) return true;
        return Arrays.asList(languages).contains(filter.getLanguage());
    }

    private boolean matchesInterest(DiscoveryFilter filter, String[] interests) {
        if (filter.getInterest() == null || interests == null) return true;
        return Arrays.asList(interests).contains(filter.getInterest());
    }

    private double resolvedLat(DiscoveryFilter filter, User user) {
        if (filter.getLat() != null) return filter.getLat();
        if (user.getLocationLat() != null) return user.getLocationLat().doubleValue();
        throw new IllegalArgumentException("Location required for discovery");
    }

    private double resolvedLng(DiscoveryFilter filter, User user) {
        if (filter.getLng() != null) return filter.getLng();
        if (user.getLocationLng() != null) return user.getLocationLng().doubleValue();
        throw new IllegalArgumentException("Location required for discovery");
    }

    private Double resolvedLatOptional(DiscoveryFilter filter, User user) {
        if (filter.getLat() != null) return filter.getLat();
        if (user.getLocationLat() != null) return user.getLocationLat().doubleValue();
        return null;
    }

    private Double resolvedLngOptional(DiscoveryFilter filter, User user) {
        if (filter.getLng() != null) return filter.getLng();
        if (user.getLocationLng() != null) return user.getLocationLng().doubleValue();
        return null;
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    /**
     * Haversine formula — returns distance in km between two lat/lng points.
     */
    private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
