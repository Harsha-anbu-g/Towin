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
import com.towinly.common.geo.CoarseLocation;
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

/**
 * Browsing elders and helpers, nearest first.
 *
 * <p>SEC-07, deliberately left in memory: every active profile is loaded, ranked in
 * Java and then cut to one page. The response is bounded (the filter clamps the page
 * size to {@link com.towinly.common.web.PageLimits#MAX_PAGE_SIZE}), so no caller can
 * take the directory in one request any more, but the query itself is still unbounded.
 *
 * <p>Ordering in the database instead would mean a native query that re-implements
 * {@link CoarseLocation#snap} and the haversine in SQL. That duplicates the one control
 * SEC-01 just centralised, in a second language where it can drift out of step; it moves
 * the demo-seat fallback below (which deliberately ignores the radius) onto a path this
 * repo cannot exercise, since database tests are gated behind TOWINLY_DB_TESTS; and it
 * moves ordering out of reach of the unit tests that pin the distance bands. That is a
 * bad trade for a memory saving on a directory that fits in memory today.
 *
 * <p>The safe next step, when the directory outgrows this, is a bounding-box predicate on
 * the repository query (lat/lng BETWEEN the box for the clamped radius, widened by one
 * 0.02 degree cell so a row stored before SEC-01 cannot fall out) with the current
 * unbounded query kept for the demo fallback. A box contains its circle, so that is
 * provably behaviour-preserving. It belongs in its own story with its own tests.
 */
@Service
@RequiredArgsConstructor
public class DiscoveryService {

    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final UserRepository userRepository;
    private final TrustScoreService trustScoreService;
    private final S3Service s3Service;
    private final BlockService blockService;

    @Cacheable(value = "discovery-elders", key = "#requestingUserId + '-' + #filter.lat + '-' + #filter.lng + '-' + #filter.radiusKm + '-' + #filter.language + '-' + #filter.interest + '-' + #filter.page + '-' + #filter.size")
    public List<DiscoveredUserResponse> discoverElders(UUID requestingUserId, DiscoveryFilter filter) {
        User requester = getUser(requestingUserId);
        // SEC-01: measure from the caller's cell, never from a swept origin.
        double[] origin = CoarseLocation.origin(filter.getLat(), filter.getLng(),
                requester.getLocationLat(), requester.getLocationLng());
        if (origin == null) throw new IllegalArgumentException("Location required for discovery");
        double lat = origin[0];
        double lng = origin[1];

        // HARD-106: a block in either direction removes the person here, before ranking.
        Set<UUID> hidden = blockService.hiddenFor(requestingUserId);
        List<Map.Entry<ElderProfile, Double>> ranked = elderProfileRepository.findAllActiveWithLocation(requestingUserId)
                .stream()
                .filter(p -> !hidden.contains(p.getUser().getId()))
                .filter(p -> matchesLanguage(filter, p.getLanguages()))
                .filter(p -> matchesInterest(filter, p.getInterests()))
                .map(p -> Map.entry(p, cellDistanceKm(lat, lng, p.getUser())))
                .sorted(Comparator.comparingDouble(Map.Entry::getValue))
                .collect(Collectors.toList());

        List<Map.Entry<ElderProfile, Double>> withinRadius = ranked.stream()
                .filter(e -> e.getValue() <= filter.getRadiusKm())
                .collect(Collectors.toList());

        return visibleFor(withinRadius, ranked, requester).stream()
                .skip((long) filter.getPage() * filter.getSize())
                .limit(filter.getSize())
                .map(e -> toElderResponse(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    @Cacheable(value = "discovery-helpers", key = "#requestingUserId + '-' + #filter.lat + '-' + #filter.lng + '-' + #filter.radiusKm + '-' + #filter.language + '-' + #filter.page + '-' + #filter.size")
    public List<DiscoveredUserResponse> discoverHelpers(UUID requestingUserId, DiscoveryFilter filter) {
        User requester = getUser(requestingUserId);
        double[] origin = CoarseLocation.origin(filter.getLat(), filter.getLng(),
                requester.getLocationLat(), requester.getLocationLng());
        boolean hasLocation = origin != null;
        double lat = hasLocation ? origin[0] : 0.0;
        double lng = hasLocation ? origin[1] : 0.0;

        Set<UUID> hidden = blockService.hiddenFor(requestingUserId);
        List<Map.Entry<HelperProfile, Double>> ranked = helperProfileRepository.findAllActiveWithLocation(requestingUserId)
                .stream()
                .filter(p -> !hidden.contains(p.getUser().getId()))
                .filter(p -> matchesLanguage(filter, p.getLanguages()))
                .map(p -> {
                    boolean helperHasLocation = p.getUser().getLocationLat() != null && p.getUser().getLocationLng() != null;
                    double dist = (hasLocation && helperHasLocation)
                            ? cellDistanceKm(lat, lng, p.getUser())
                            : 0.0;
                    return Map.entry(p, dist);
                })
                .sorted(Comparator.comparingDouble(Map.Entry::getValue))
                .collect(Collectors.toList());

        List<Map.Entry<HelperProfile, Double>> withinRadius = ranked.stream()
                .filter(e -> !hasLocation || e.getValue() <= filter.getRadiusKm())
                .collect(Collectors.toList());

        return visibleFor(withinRadius, ranked, requester).stream()
                .skip((long) filter.getPage() * filter.getSize())
                .limit(filter.getSize())
                .map(e -> toHelperResponse(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
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
                .distanceKm(CoarseLocation.bandKm(distanceKm))
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
                .distanceKm(CoarseLocation.bandKm(distanceKm))
                .build();
    }

    /**
     * Distance from the origin to the person's cell. Their stored coordinate is
     * snapped here as well as on write, so rows saved before SEC-01 leak nothing.
     */
    private double cellDistanceKm(double lat, double lng, User person) {
        return CoarseLocation.haversineKm(lat, lng,
                CoarseLocation.snap(person.getLocationLat()).doubleValue(),
                CoarseLocation.snap(person.getLocationLng()).doubleValue());
    }

    /**
     * Sample/demo accounts must never show an empty list — a barren demo looks broken.
     * When nobody is within the requested radius, fall back to the nearest people
     * (radius ignored) so there's always something to explore. Real accounts stay strict.
     */
    private <T> List<Map.Entry<T, Double>> visibleFor(List<Map.Entry<T, Double>> withinRadius,
                                                      List<Map.Entry<T, Double>> ranked, User requester) {
        return (withinRadius.isEmpty() && isDemoAccount(requester)) ? ranked : withinRadius;
    }

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

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
