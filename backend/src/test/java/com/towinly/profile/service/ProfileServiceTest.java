package com.towinly.profile.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import com.towinly.profile.dto.ElderProfileRequest;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock com.towinly.common.service.TrustScoreService trustScoreService;
    @Mock com.towinly.geocoding.GeocodingService geocodingService;
    @Mock com.towinly.common.service.S3Service s3Service;
    @Mock com.towinly.connection.repository.ConnectionRepository connectionRepository;
    @InjectMocks ProfileService profileService;

    @Test
    void shouldCreateElderProfile() {
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("test@test.com")
                .phone("+1234567890")
                .passwordHash("hash")
                .role(UserRole.ELDER)
                .trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(elderProfileRepository.save(any(ElderProfile.class))).thenAnswer(i -> i.getArgument(0));

        ElderProfileRequest request = new ElderProfileRequest();
        request.setName("John Elder");
        request.setAge(72);

        assertThatNoException().isThrownBy(
                () -> profileService.createOrUpdateElderProfile(userId, request));

        verify(elderProfileRepository).save(any(ElderProfile.class));
    }

    @Test
    void updateLocationSetsCityFromGeocoder() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(geocodingService.reverseGeocode(43.65, -79.38)).thenReturn("Toronto");

        profileService.updateLocation(userId, 43.65, -79.38, null);

        assertThat(user.getCity()).isEqualTo("Toronto");
        // SEC-01: what is STORED is the 0.02 degree grid vertex, not the fix that
        // arrived. 43.65 sits between vertices and lands on 43.66. The city lookup
        // above is still made with the precise point, so the name stays right; only
        // the coordinate that a distance can be measured against is coarsened.
        assertThat(user.getLocationLat().doubleValue()).isEqualTo(43.66);
        assertThat(user.getLocationLng().doubleValue()).isEqualTo(-79.38);
    }

    @Test
    void updateLocationRefusesToStoreAPrecisePoint() {
        // The website sends pos.coords.latitude straight from the browser, so the
        // grid has to be enforced here rather than trusted to the caller. Without
        // it, three /discover calls from chosen origins solve for a doorstep.
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(geocodingService.reverseGeocode(anyDouble(), anyDouble())).thenReturn("Montreal");

        profileService.updateLocation(userId, 45.47651234, -73.61279876, null);

        assertThat(user.getLocationLat().doubleValue()).isEqualTo(45.48);
        assertThat(user.getLocationLng().doubleValue()).isEqualTo(-73.62);
        // Every address inside one cell collapses to the same stored value.
        assertThat(user.getLocationLat().scale()).isLessThanOrEqualTo(2);
    }

    @Test
    void updateLocationStillSavesCoordsWhenGeocodeFails() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).city("OldCity").isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(geocodingService.reverseGeocode(anyDouble(), anyDouble())).thenReturn(null);

        profileService.updateLocation(userId, 1.0, 2.0, null);

        assertThat(user.getLocationLat().doubleValue()).isEqualTo(1.0);
        assertThat(user.getCity()).isEqualTo("OldCity"); // unchanged on null
    }

    @Test
    void strangerView_hidesEmailDobPhoneAndAccountMeta() {
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .username("johne")
                .email("private@test.com")
                .phone("+1234567890")
                .passwordHash("hash")
                .authProvider("GOOGLE")
                .dateOfBirth(java.time.LocalDate.of(1950, 3, 14))
                .role(UserRole.ELDER)
                .trustScore(40.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        var response = profileService.getProfile(userId, UUID.randomUUID());

        assertThat(response.getEmail()).isNull();
        assertThat(response.getDateOfBirth()).isNull();
        assertThat(response.getPhone()).isNull();
        assertThat(response.getAuthProvider()).isNull();
        assertThat(response.isHasPassword()).isFalse();
        // Public fields still come through untouched.
        assertThat(response.getUsername()).isEqualTo("johne");
        assertThat(response.getTrustScore()).isEqualTo(40);
    }

    @Test
    void selfView_keepsEmailDobAndPhone() {
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .username("johne")
                .email("private@test.com")
                .phone("+1234567890")
                .passwordHash("hash")
                .authProvider("GOOGLE")
                .dateOfBirth(java.time.LocalDate.of(1950, 3, 14))
                .role(UserRole.ELDER)
                .trustScore(40.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        var response = profileService.getProfile(userId, userId);

        assertThat(response.getEmail()).isEqualTo("private@test.com");
        assertThat(response.getDateOfBirth()).isEqualTo("1950-03-14");
        assertThat(response.getPhone()).isEqualTo("+1234567890");
        assertThat(response.getAuthProvider()).isEqualTo("GOOGLE");
        assertThat(response.isHasPassword()).isTrue();
    }

    @Test
    void shouldThrowWhenUserNotFound() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        ElderProfileRequest request = new ElderProfileRequest();
        request.setName("John");
        request.setAge(70);

        assertThatThrownBy(() -> profileService.createOrUpdateElderProfile(userId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    // SEC-06: rung 4 of the ladder is literally named "Socials", so the handles
    // belong to people who have reached it. They used to be handed to any signed-in
    // stranger, which is the cross-platform link the ladder exists to withhold.
    private com.towinly.profile.entity.ElderProfile elderWithSocials() {
        return com.towinly.profile.entity.ElderProfile.builder()
                .name("Margaret")
                .lookingFor(com.towinly.common.enums.LookingForType.BOTH)
                .facebookUrl("https://facebook.com/margaret")
                .instagramUrl("https://instagram.com/margaret")
                .build();
    }

    private com.towinly.connection.entity.Connection connectionAt(
            com.towinly.common.enums.ConnectionStatus status,
            com.towinly.common.enums.TrustLevel level) {
        return com.towinly.connection.entity.Connection.builder()
                .status(status)
                .currentTrustLevel(level)
                .build();
    }

    @Test
    void strangerNeverSeesSocialHandles() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).username("margaret").trustScore(40.0).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.of(elderWithSocials()));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        // No connection at all: the default Optional.empty() stands.

        var response = profileService.getProfile(userId, UUID.randomUUID());

        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
        // The rest of the public profile is untouched.
        assertThat(response.getName()).isEqualTo("Margaret");
    }

    @Test
    void aConnectionBelowTheSocialsRungStillSeesNoHandles() {
        UUID userId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = User.builder().id(userId).username("margaret").trustScore(40.0).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.of(elderWithSocials()));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findBetweenUsers(viewerId, userId)).thenReturn(Optional.of(
                connectionAt(com.towinly.common.enums.ConnectionStatus.ACTIVE,
                        com.towinly.common.enums.TrustLevel.VIDEO_CALL)));

        var response = profileService.getProfile(userId, viewerId);

        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
    }

    @Test
    void reachingTheSocialsRungRevealsTheHandles() {
        UUID userId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = User.builder().id(userId).username("margaret").trustScore(40.0).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.of(elderWithSocials()));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findBetweenUsers(viewerId, userId)).thenReturn(Optional.of(
                connectionAt(com.towinly.common.enums.ConnectionStatus.ACTIVE,
                        com.towinly.common.enums.TrustLevel.VERIFIED)));

        var response = profileService.getProfile(userId, viewerId);

        assertThat(response.getFacebookUrl()).isEqualTo("https://facebook.com/margaret");
        assertThat(response.getInstagramUrl()).isEqualTo("https://instagram.com/margaret");
    }

    @Test
    void anUnacceptedRequestEarnsNoHandles_evenAtAHighLevel() {
        // The score head-start opens a PENDING connection at a high rung, so
        // status has to be checked as well as level (the same hole SEC-02 closed
        // for the phone number).
        UUID userId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = User.builder().id(userId).username("margaret").trustScore(40.0).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.of(elderWithSocials()));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findBetweenUsers(viewerId, userId)).thenReturn(Optional.of(
                connectionAt(com.towinly.common.enums.ConnectionStatus.PENDING,
                        com.towinly.common.enums.TrustLevel.TRUSTED)));

        var response = profileService.getProfile(userId, viewerId);

        assertThat(response.getFacebookUrl()).isNull();
    }

    @Test
    void theOwnerAlwaysSeesTheirOwnHandles() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).username("margaret").trustScore(40.0).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.of(elderWithSocials()));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());

        var response = profileService.getProfile(userId, userId);

        assertThat(response.getFacebookUrl()).isEqualTo("https://facebook.com/margaret");
        // Reading your own profile must never need a connection lookup.
        verify(connectionRepository, never()).findBetweenUsers(any(), any());
    }
}
