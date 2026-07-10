package com.towin.discovery.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.common.seed.DemoDataSeeder;
import com.towin.discovery.dto.DiscoveredUserResponse;
import com.towin.discovery.dto.DiscoveryFilter;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiscoveryService {

    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final UserRepository userRepository;
    private final TrustScoreService trustScoreService;
    private final S3Service s3Service;

    @Cacheable(value = "discovery-elders", key = "#requestingUserId + '-' + #filter.lat + '-' + #filter.lng + '-' + #filter.radiusKm + '-' + #filter.language + '-' + #filter.interest + '-' + #filter.page")
    public List<DiscoveredUserResponse> discoverElders(UUID requestingUserId, DiscoveryFilter filter) {
        User requester = getUser(requestingUserId);
        double lat = resolvedLat(filter, requester);
        double lng = resolvedLng(filter, requester);

        List<Map.Entry<ElderProfile, Double>> ranked = elderProfileRepository.findAllActiveWithLocation(requestingUserId)
                .stream()
                .filter(p -> matchesLanguage(filter, p.getLanguages()))
                .filter(p -> matchesInterest(filter, p.getInterests()))
                .map(p -> Map.entry(p, haversineKm(lat, lng,
                        p.getUser().getLocationLat().doubleValue(),
                        p.getUser().getLocationLng().doubleValue())))
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

    @Cacheable(value = "discovery-helpers", key = "#requestingUserId + '-' + #filter.lat + '-' + #filter.lng + '-' + #filter.radiusKm + '-' + #filter.language + '-' + #filter.page")
    public List<DiscoveredUserResponse> discoverHelpers(UUID requestingUserId, DiscoveryFilter filter) {
        User requester = getUser(requestingUserId);
        Double lat = resolvedLatOptional(filter, requester);
        Double lng = resolvedLngOptional(filter, requester);
        boolean hasLocation = lat != null && lng != null;

        List<Map.Entry<HelperProfile, Double>> ranked = helperProfileRepository.findAllActiveWithLocation(requestingUserId)
                .stream()
                .filter(p -> matchesLanguage(filter, p.getLanguages()))
                .map(p -> {
                    boolean helperHasLocation = p.getUser().getLocationLat() != null && p.getUser().getLocationLng() != null;
                    double dist = (hasLocation && helperHasLocation)
                            ? haversineKm(lat, lng,
                                    p.getUser().getLocationLat().doubleValue(),
                                    p.getUser().getLocationLng().doubleValue())
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
