package com.towin.discovery.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.discovery.dto.DiscoveredUserResponse;
import com.towin.discovery.dto.DiscoveryFilter;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DiscoveryServiceTest {

    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock UserRepository userRepository;
    @Mock TrustScoreService trustScoreService;
    @Mock S3Service s3Service;

    @InjectMocks DiscoveryService discoveryService;

    UUID requesterId = UUID.randomUUID();
    User requester;

    // Requester sits at (13.0, 80.0). 0.01° of latitude ≈ 1.11 km.
    private static final double HOME_LAT = 13.0;
    private static final double HOME_LNG = 80.0;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        requester = userAt(requesterId, HOME_LAT, HOME_LNG);
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(requester));
    }

    // ── discoverElders ───────────────────────────────────────────────────────

    @Test
    void discoverElders_throwsWhenRequesterMissing() {
        UUID unknown = UUID.randomUUID();
        when(userRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> discoveryService.discoverElders(unknown, new DiscoveryFilter()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void discoverElders_throwsWhenNoLocationAvailableAnywhere() {
        requester.setLocationLat(null);
        requester.setLocationLng(null);

        assertThatThrownBy(() -> discoveryService.discoverElders(requesterId, new DiscoveryFilter()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Location required");
    }

    @Test
    void discoverElders_sortsByDistanceNearestFirst() {
        ElderProfile near = elderAt("Near", HOME_LAT + 0.01, HOME_LNG);   // ~1.1 km
        ElderProfile far = elderAt("Far", HOME_LAT + 0.05, HOME_LNG);     // ~5.6 km
        // Repository returns them farthest-first to prove the service re-sorts.
        elders(far, near);

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, new DiscoveryFilter());

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("Near");
        assertThat(result.get(0).getDistanceKm()).isEqualTo(1.1);
        assertThat(result.get(1).getName()).isEqualTo("Far");
        assertThat(result.get(1).getDistanceKm()).isEqualTo(5.6);
    }

    @Test
    void discoverElders_excludesEldersBeyondRadius() {
        ElderProfile near = elderAt("Near", HOME_LAT + 0.01, HOME_LNG);       // ~1.1 km
        ElderProfile tooFar = elderAt("TooFar", HOME_LAT + 0.5, HOME_LNG);    // ~55.6 km
        elders(near, tooFar);

        // Default radius is 10 km.
        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Near");
    }

    @Test
    void discoverElders_filtersByLanguage() {
        ElderProfile tamil = elderAt("Tamil", HOME_LAT + 0.01, HOME_LNG);
        tamil.setLanguages(new String[]{"Tamil", "English"});
        ElderProfile hindiOnly = elderAt("Hindi", HOME_LAT + 0.01, HOME_LNG);
        hindiOnly.setLanguages(new String[]{"Hindi"});
        elders(tamil, hindiOnly);

        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setLanguage("Tamil");

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, filter);

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Tamil");
    }

    @Test
    void discoverElders_filtersByInterest() {
        ElderProfile gardener = elderAt("Gardener", HOME_LAT + 0.01, HOME_LNG);
        gardener.setInterests(new String[]{"gardening"});
        ElderProfile chessPlayer = elderAt("Chess", HOME_LAT + 0.01, HOME_LNG);
        chessPlayer.setInterests(new String[]{"chess"});
        elders(gardener, chessPlayer);

        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setInterest("gardening");

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, filter);

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Gardener");
    }

    @Test
    void discoverElders_paginatesAfterSortingByDistance() {
        ElderProfile nearest = elderAt("Nearest", HOME_LAT + 0.01, HOME_LNG);
        ElderProfile second = elderAt("Second", HOME_LAT + 0.02, HOME_LNG);
        ElderProfile third = elderAt("Third", HOME_LAT + 0.03, HOME_LNG);
        elders(third, nearest, second);

        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setSize(1);
        filter.setPage(1);

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, filter);

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Second");
    }

    @Test
    void discoverElders_usesFilterCoordinatesWhenRequesterHasNoLocation() {
        requester.setLocationLat(null);
        requester.setLocationLng(null);
        ElderProfile near = elderAt("Near", HOME_LAT + 0.01, HOME_LNG);
        elders(near);

        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setLat(HOME_LAT);
        filter.setLng(HOME_LNG);

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, filter);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDistanceKm()).isEqualTo(1.1);
    }

    @Test
    void discoverElders_mapsProfileFieldsAndPresignsPhoto() {
        ElderProfile elder = elderAt("Meena", HOME_LAT + 0.01, HOME_LNG);
        elder.setPhotoUrl("raw-s3-url");
        elder.setBio("I love gardening");
        elder.getUser().setTrustScore(7.4);
        elder.getUser().setCity("Chennai");
        elders(elder);
        when(s3Service.presignedUrl("raw-s3-url")).thenReturn("signed-url");

        DiscoveredUserResponse r = discoveryService.discoverElders(requesterId, new DiscoveryFilter()).get(0);

        assertThat(r.getUserId()).isEqualTo(elder.getUser().getId());
        assertThat(r.getName()).isEqualTo("Meena");
        assertThat(r.getAge()).isEqualTo(70);
        assertThat(r.getPhotoUrl()).isEqualTo("signed-url");
        assertThat(r.getBio()).isEqualTo("I love gardening");
        assertThat(r.getCity()).isEqualTo("Chennai");
        assertThat(r.getTrustScore()).isEqualTo(7); // 7.4 rounded
        assertThat(r.getTrustTier()).isEqualTo("Getting Started");
        verify(s3Service).presignedUrl("raw-s3-url");
    }

    @Test
    void discoverElders_defaultsNullScoreAndArraysSafely() {
        ElderProfile elder = elderAt("Bare", HOME_LAT + 0.01, HOME_LNG);
        elder.setInterests(null);
        elder.setLanguages(null);
        elder.getUser().setTrustScore(null);
        elders(elder);

        DiscoveredUserResponse r = discoveryService.discoverElders(requesterId, new DiscoveryFilter()).get(0);

        assertThat(r.getTrustScore()).isZero();
        assertThat(r.getTrustTier()).isEqualTo("New Member");
        assertThat(r.getInterests()).isEmpty();
        assertThat(r.getLanguages()).isEmpty();
    }

    // ── discoverHelpers ──────────────────────────────────────────────────────

    @Test
    void discoverHelpers_includesHelpersWithoutLocationAtZeroDistance() {
        HelperProfile located = helperAt("Located", HOME_LAT + 0.01, HOME_LNG);
        HelperProfile nomad = helperWithoutLocation("Nomad");
        helpers(located, nomad);

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).hasSize(2);
        // Distance for a helper with no location defaults to 0.0, so they sort first.
        assertThat(result.get(0).getName()).isEqualTo("Nomad");
        assertThat(result.get(0).getDistanceKm()).isEqualTo(0.0);
        assertThat(result.get(1).getName()).isEqualTo("Located");
    }

    @Test
    void discoverHelpers_excludesHelpersBeyondRadiusWhenBothSidesHaveLocation() {
        HelperProfile near = helperAt("Near", HOME_LAT + 0.01, HOME_LNG);      // ~1.1 km
        HelperProfile tooFar = helperAt("TooFar", HOME_LAT + 0.5, HOME_LNG);   // ~55.6 km
        helpers(near, tooFar);

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Near");
    }

    @Test
    void discoverHelpers_worksWithoutAnyLocationInsteadOfThrowing() {
        requester.setLocationLat(null);
        requester.setLocationLng(null);
        HelperProfile helper = helperAt("Anywhere", HOME_LAT + 0.5, HOME_LNG); // far, but no radius applies
        helpers(helper);

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDistanceKm()).isEqualTo(0.0);
    }

    @Test
    void discoverHelpers_filtersByLanguage() {
        HelperProfile english = helperAt("English", HOME_LAT + 0.01, HOME_LNG);
        english.setLanguages(new String[]{"English"});
        HelperProfile tamil = helperAt("Tamil", HOME_LAT + 0.01, HOME_LNG);
        tamil.setLanguages(new String[]{"Tamil"});
        helpers(english, tamil);

        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setLanguage("Tamil");

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, filter);

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Tamil");
    }

    @Test
    void discoverHelpers_mapsSkillsAndHobbies() {
        HelperProfile helper = helperAt("Ravi", HOME_LAT + 0.01, HOME_LNG);
        helper.setSkillsOffered(new String[]{"cooking", "driving"});
        helper.setHobbies(new String[]{"cricket"});
        helpers(helper);

        DiscoveredUserResponse r = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter()).get(0);

        assertThat(r.getSkillsOffered()).containsExactly("cooking", "driving");
        // Helper hobbies are surfaced through the shared "interests" field.
        assertThat(r.getInterests()).containsExactly("cricket");
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    private void elders(ElderProfile... profiles) {
        when(elderProfileRepository.findAllActiveWithLocation(requesterId)).thenReturn(List.of(profiles));
    }

    private void helpers(HelperProfile... profiles) {
        when(helperProfileRepository.findAllActiveWithLocation(requesterId)).thenReturn(List.of(profiles));
    }

    private User userAt(UUID id, double lat, double lng) {
        return User.builder()
                .id(id)
                .email(id + "@test.com")
                .username("u-" + id)
                .passwordHash("hash")
                .trustScore(0.0)
                .locationLat(BigDecimal.valueOf(lat))
                .locationLng(BigDecimal.valueOf(lng))
                .isActive(true)
                .build();
    }

    private ElderProfile elderAt(String name, double lat, double lng) {
        return ElderProfile.builder()
                .id(UUID.randomUUID())
                .user(userAt(UUID.randomUUID(), lat, lng))
                .name(name)
                .age(70)
                .interests(new String[]{"gardening"})
                .languages(new String[]{"English"})
                .build();
    }

    private HelperProfile helperAt(String name, double lat, double lng) {
        return HelperProfile.builder()
                .id(UUID.randomUUID())
                .user(userAt(UUID.randomUUID(), lat, lng))
                .name(name)
                .age(30)
                .languages(new String[]{"English"})
                .build();
    }

    private HelperProfile helperWithoutLocation(String name) {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email(UUID.randomUUID() + "@test.com")
                .username("u-" + UUID.randomUUID())
                .passwordHash("hash")
                .trustScore(0.0)
                .isActive(true)
                .build();
        return HelperProfile.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name(name)
                .age(30)
                .languages(new String[]{"English"})
                .build();
    }
}
