package com.towinly.discovery.service;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.S3Service;
import com.towinly.common.service.TrustScoreService;
import com.towinly.discovery.dto.DiscoveredUserResponse;
import com.towinly.discovery.dto.DiscoveryFilter;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DiscoveryServiceTest {

    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock UserRepository userRepository;
    @Mock TrustScoreService trustScoreService;
    @Mock S3Service s3Service;
    @Mock com.towinly.block.service.BlockService blockService;
    @Mock MutualFriendsService mutualFriendsService;

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
    void discoverElders_skipsARowWithHalfACoordinateInsteadOfFailingTheWholeScreen() {
        // PUT /api/profile/location takes a latitude with no longitude, and the elder query
        // guards the latitude only, so such a row reached the distance maths and threw:
        // one account could blank the discovery screen for everybody.
        ElderProfile halfPlaced = elderAt("HalfPlaced", HOME_LAT + 0.01, HOME_LNG);
        halfPlaced.getUser().setLocationLng(null);
        ElderProfile placed = elderAt("Placed", HOME_LAT + 0.01, HOME_LNG);
        elders(halfPlaced, placed);

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Placed");
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

    // R2-DISC: a distance we never measured is not a distance of nought.
    // This test used to assert the opposite - that a helper with no stored coordinate
    // is listed at 0.0 km, ahead of the real neighbour - which is the hole itself.
    @Test
    void discoverHelpers_hidesAHelperWithNoStoredLocationInsteadOfPlacingThemAtZeroKm() {
        HelperProfile located = helperAt("Located", HOME_LAT + 0.01, HOME_LNG);
        HelperProfile nomad = helperWithoutLocation("Nomad");
        helpers(located, nomad);

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Located");
    }

    @Test
    void discoverHelpers_doesNotLetAnUnplaceableHelperSlipPastTheRadius() {
        // 0.0 is inside every ceiling, so a helper who never shared a location used to
        // pass the radius filter for every caller on earth, however narrow the ask.
        helpers(helperWithoutLocation("Nomad"));
        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setRadiusKm(1.0);

        assertThat(discoveryService.discoverHelpers(requesterId, filter)).isEmpty();
    }

    @Test
    void discoverHelpers_forACallerWithNoLocationListsPlacedHelpersAndSkipsTheRest() {
        // The caller keeps their results (the deliberate short circuit), but nothing was
        // measured, so nobody is claimed to be nearby and an unplaceable helper stays out.
        requester.setLocationLat(null);
        requester.setLocationLng(null);
        helpers(helperAt("Anywhere", HOME_LAT + 0.5, HOME_LNG), helperWithoutLocation("Nomad"));

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Anywhere");
        assertThat(result.get(0).getDistanceKm()).isEqualTo(0.0);
    }

    @Test
    void discoverHelpers_stillFallsBackToTheNearestHelpersForADemoSeat() {
        // A store reviewer signs in on the demo seat; an empty helper screen looks broken,
        // so the radius is ignored for them. Dropping unplaceable helpers must not end that.
        requester.setEmail(com.towinly.common.seed.DemoDataSeeder.ELDER_DEMO_EMAIL);
        helpers(helperAt("FarAway", HOME_LAT + 1.35, HOME_LNG));   // ~150 km, well past the 10 km default

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("FarAway");
    }

    @Test
    void discoverHelpers_demoFallbackDoesNotBringBackAnUnplaceableHelper() {
        requester.setEmail(com.towinly.common.seed.DemoDataSeeder.ELDER_DEMO_EMAIL);
        helpers(helperAt("FarAway", HOME_LAT + 1.35, HOME_LNG), helperWithoutLocation("Nomad"));

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("FarAway");
    }

    @Test
    void theHelperDirectoryQueryOnlyLoadsPeopleWhoHaveAStoredLocation() throws Exception {
        // The service filters as well, but a row we can never place should not leave the
        // database at all - the method is called findAllActiveWithLocation, so let it mean it.
        String jpql = HelperProfileRepository.class
                .getMethod("findAllActiveWithLocation", UUID.class)
                .getAnnotation(org.springframework.data.jpa.repository.Query.class)
                .value();

        assertThat(jpql).contains("u.locationLat IS NOT NULL").contains("u.locationLng IS NOT NULL");
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

    // HARD-106: discovery never shows a person either side has blocked.
    @Test
    void discoverElders_hidesPeopleBlockedInEitherDirection() {
        ElderProfile hidden = elderAt("Hidden", HOME_LAT + 0.01, HOME_LNG);
        ElderProfile shown = elderAt("Shown", HOME_LAT + 0.02, HOME_LNG);
        elders(hidden, shown);
        when(blockService.hiddenFor(requesterId)).thenReturn(java.util.Set.of(hidden.getUser().getId()));

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Shown");
    }

    @Test
    void discoverHelpers_hidesPeopleBlockedInEitherDirection() {
        HelperProfile hidden = helperAt("Hidden", HOME_LAT + 0.01, HOME_LNG);
        HelperProfile shown = helperAt("Shown", HOME_LAT + 0.02, HOME_LNG);
        helpers(hidden, shown);
        when(blockService.hiddenFor(requesterId)).thenReturn(java.util.Set.of(hidden.getUser().getId()));

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, new DiscoveryFilter());

        assertThat(result).extracting(DiscoveredUserResponse::getName).containsExactly("Shown");
    }

    // SEC-07: size arrives straight from the query string. Uncapped it read
    // "?size=100000" and handed back the whole member directory in one response.
    // No client has ever sent size at all — the two dashboards use the default 20 —
    // so the cap costs a real screen nothing.
    @Test
    void discoverElders_clampsAnOversizedPageToTheServerMaximum() {
        ElderProfile[] directory = new ElderProfile[DiscoveryFilter.MAX_PAGE_SIZE + 25];
        for (int i = 0; i < directory.length; i++) {
            directory[i] = elderAt("Elder " + i, HOME_LAT + 0.0001 * i, HOME_LNG);
        }
        elders(directory);
        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setSize(100000);
        filter.setRadiusKm(100000.0);

        List<DiscoveredUserResponse> result = discoveryService.discoverElders(requesterId, filter);

        assertThat(result).hasSize(DiscoveryFilter.MAX_PAGE_SIZE);
    }

    @Test
    void discoverHelpers_clampsAnOversizedPageToTheServerMaximum() {
        HelperProfile[] directory = new HelperProfile[DiscoveryFilter.MAX_PAGE_SIZE + 25];
        for (int i = 0; i < directory.length; i++) {
            directory[i] = helperAt("Helper " + i, HOME_LAT + 0.0001 * i, HOME_LNG);
        }
        helpers(directory);
        DiscoveryFilter filter = new DiscoveryFilter();
        filter.setSize(100000);

        List<DiscoveredUserResponse> result = discoveryService.discoverHelpers(requesterId, filter);

        assertThat(result).hasSize(DiscoveryFilter.MAX_PAGE_SIZE);
    }

    @Test
    void anOrdinaryRequestIsUntouched() {
        DiscoveryFilter filter = new DiscoveryFilter();

        // What every real caller sends today: nothing at all, so the defaults stand.
        assertThat(filter.getSize()).isEqualTo(20);
        assertThat(filter.getRadiusKm()).isEqualTo(10.0);

        // And the largest values the radius selector actually offers still pass through.
        filter.setRadiusKm(100.0);
        filter.setSize(50);
        assertThat(filter.getRadiusKm()).isEqualTo(100.0);
        assertThat(filter.getSize()).isEqualTo(50);
    }

    @Test
    void theFilterClampsBothBoundsAtBindingTime() {
        DiscoveryFilter filter = new DiscoveryFilter();

        filter.setSize(100000);
        filter.setRadiusKm(100000.0);
        assertThat(filter.getSize()).isEqualTo(DiscoveryFilter.MAX_PAGE_SIZE);
        assertThat(filter.getRadiusKm()).isEqualTo(DiscoveryFilter.MAX_RADIUS_KM);

        // A size of zero or below would otherwise reach Stream.limit and throw.
        filter.setSize(0);
        assertThat(filter.getSize()).isEqualTo(1);
        filter.setSize(-5);
        assertThat(filter.getSize()).isEqualTo(1);
    }

    // Both reads hand back the same directory: the bounded read is how discovery
    // pages now (SEC-07), the unbounded one is the demo fallback — and the service
    // applies its own radius and coordinate filters either way, so every
    // exclusion test below still proves what it always proved.
    private void elders(ElderProfile... profiles) {
        when(elderProfileRepository.findAllActiveWithLocation(requesterId)).thenReturn(List.of(profiles));
        when(elderProfileRepository.findAllActiveWithLocationInBox(
                eq(requesterId), any(), any(), any(), any())).thenReturn(List.of(profiles));
    }

    private void helpers(HelperProfile... profiles) {
        when(helperProfileRepository.findAllActiveWithLocation(requesterId)).thenReturn(List.of(profiles));
        when(helperProfileRepository.findAllActiveWithLocationInBox(
                eq(requesterId), any(), any(), any(), any())).thenReturn(List.of(profiles));
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
