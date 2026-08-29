package com.towinly.profile.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import com.towinly.profile.dto.ElderProfileRequest;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.Gender;
import com.towinly.common.enums.TrustLevel;
import com.towinly.connection.entity.Connection;
import com.towinly.profile.entity.HelperProfile;
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
    @Mock com.towinly.block.service.BlockService blockService;
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
        assertThat(user.getLocationLat().doubleValue()).isEqualTo(43.66); // 43.65 sits on a half cell; the cell wins
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

        var response = profileService.getProfile(userId, UUID.randomUUID()); // read by a stranger

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

        var response = profileService.getProfile(userId, userId); // read by the owner

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


    // ── SEC-01: the server stores the cell, never the fix ────────────────────

    @Test
    void updateLocation_storesTheCellNotTheRawFix() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(geocodingService.reverseGeocode(anyDouble(), anyDouble())).thenReturn(null);

        profileService.updateLocation(userId, 45.4823, -73.5674, null);

        assertThat(user.getLocationLat()).isEqualByComparingTo("45.48");
        assertThat(user.getLocationLng()).isEqualByComparingTo("-73.56");
    }


    // ── SEC-06: a Facebook handle is step 4 of the ladder, not a public field ──
    //
    // Socials (and gender) leave the server only for the owner, or for someone on
    // an ACTIVE connection that has climbed to VERIFIED. ACTIVE is the load-bearing
    // half: ConnectionService.sendRequest stamps a PENDING request VERIFIED for any
    // sender scoring 71+, so a level-only gate is one connection request from open.

    private static final String FACEBOOK = "https://facebook.com/margaret.tw";
    private static final String INSTAGRAM = "https://instagram.com/margaret.tw";

    private User subject(UUID id, UserRole role) {
        return User.builder()
                .id(id)
                .username("subject")
                .email("private@test.com")
                .role(role)
                .trustScore(40.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();
    }

    /** An elder who filled in both social fields, their occupation and their gender. */
    private ElderProfile elderWithSocials(User user) {
        return ElderProfile.builder()
                .user(user)
                .name("Margaret")
                .age(78)
                .occupation("Retired schoolteacher")
                .gender(Gender.FEMALE)
                .facebookUrl(FACEBOOK)
                .instagramUrl(INSTAGRAM)
                .build();
    }

    private HelperProfile helperWithSocials(User user) {
        return HelperProfile.builder()
                .user(user)
                .name("James")
                .age(31)
                .occupation("Student")
                .gender(Gender.MALE)
                .facebookUrl(FACEBOOK)
                .instagramUrl(INSTAGRAM)
                .build();
    }

    private void givenElder(UUID id, User user, ElderProfile elder) {
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(id)).thenReturn(Optional.of(elder));
        when(helperProfileRepository.findByUserId(id)).thenReturn(Optional.empty());
    }

    private void givenHelper(UUID id, User user, HelperProfile helper) {
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(id)).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(id)).thenReturn(Optional.of(helper));
    }

    private void givenConnection(UUID viewerId, UUID targetId, ConnectionStatus status, TrustLevel level) {
        when(connectionRepository.findBetweenUsers(viewerId, targetId)).thenReturn(Optional.of(
                Connection.builder().status(status).currentTrustLevel(level).build()));
    }

    private void givenNoConnection(UUID viewerId, UUID targetId) {
        when(connectionRepository.findBetweenUsers(viewerId, targetId)).thenReturn(Optional.empty());
    }

    @Test
    void strangerView_hidesSocialsOnElderProfile() {
        UUID targetId = UUID.randomUUID();
        UUID strangerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenNoConnection(strangerId, targetId);

        var response = profileService.getProfile(targetId, strangerId);

        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
        // The public card is untouched.
        assertThat(response.getName()).isEqualTo("Margaret");
        assertThat(response.getAge()).isEqualTo(78);
    }

    @Test
    void strangerView_hidesSocialsOnHelperProfile() {
        UUID targetId = UUID.randomUUID();
        UUID strangerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.HELPER);
        givenHelper(targetId, user, helperWithSocials(user));
        givenNoConnection(strangerId, targetId);

        var response = profileService.getProfile(targetId, strangerId);

        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
        assertThat(response.getName()).isEqualTo("James");
    }

    @Test
    void selfView_keepsSocials() {
        UUID userId = UUID.randomUUID();
        User user = subject(userId, UserRole.ELDER);
        givenElder(userId, user, elderWithSocials(user));

        var response = profileService.getProfile(userId, userId);

        assertThat(response.getFacebookUrl()).isEqualTo(FACEBOOK);
        assertThat(response.getInstagramUrl()).isEqualTo(INSTAGRAM);
        assertThat(response.getGender()).isEqualTo("FEMALE");
    }

    @Test
    void selfView_asksNobodyWhetherTheOwnerMaySeeTheirOwnSocials() {
        UUID userId = UUID.randomUUID();
        User user = subject(userId, UserRole.ELDER);
        givenElder(userId, user, elderWithSocials(user));

        profileService.getProfile(userId, userId);

        verify(connectionRepository, never()).findBetweenUsers(any(), any());
        verify(blockService, never()).isHidden(any(), any());
    }

    @Test
    void activeVerifiedConnection_releasesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnection(viewerId, targetId, ConnectionStatus.ACTIVE, TrustLevel.VERIFIED);

        var response = profileService.getProfile(targetId, viewerId);

        assertThat(response.getFacebookUrl()).isEqualTo(FACEBOOK);
        assertThat(response.getInstagramUrl()).isEqualTo(INSTAGRAM);
    }

    @Test
    void activeTrustedConnection_releasesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.HELPER);
        givenHelper(targetId, user, helperWithSocials(user));
        givenConnection(viewerId, targetId, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED);

        var response = profileService.getProfile(targetId, viewerId);

        // TRUSTED is 6, VERIFIED is 4: a pair further up the ladder keeps what a
        // VERIFIED pair has, so the comparison is >= and not ==.
        assertThat(response.getFacebookUrl()).isEqualTo(FACEBOOK);
        assertThat(response.getInstagramUrl()).isEqualTo(INSTAGRAM);
    }

    @Test
    void activeVideoCallConnection_stillHidesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnection(viewerId, targetId, ConnectionStatus.ACTIVE, TrustLevel.VIDEO_CALL);

        var response = profileService.getProfile(targetId, viewerId);

        // VIDEO_CALL is 3, one rung below VERIFIED. This pins the boundary.
        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
    }

    @Test
    void pendingVerifiedConnection_stillHidesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnection(viewerId, targetId, ConnectionStatus.PENDING, TrustLevel.VERIFIED);

        var response = profileService.getProfile(targetId, viewerId);

        // A helper scoring 71+ opens at VERIFIED the moment they send a request.
        // Nobody has accepted anything yet, so nothing is unlocked.
        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
    }

    @Test
    void endedConnectionAtTrusted_stillHidesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnection(viewerId, targetId, ConnectionStatus.ENDED, TrustLevel.TRUSTED);

        var response = profileService.getProfile(targetId, viewerId);

        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
    }

    @Test
    void declinedConnectionAtTrusted_stillHidesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnection(viewerId, targetId, ConnectionStatus.DECLINED, TrustLevel.TRUSTED);

        var response = profileService.getProfile(targetId, viewerId);

        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
    }

    @Test
    void blockedPairAtTrusted_hidesSocialsButStillReturnsTheProfile() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        user.setCity("Montreal");
        givenElder(targetId, user, elderWithSocials(user));
        when(blockService.isHidden(viewerId, targetId)).thenReturn(true);

        var response = profileService.getProfile(targetId, viewerId);

        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
        // HARD-106 hides the handles, never the 200: the phone renders its own
        // "you blocked this person" state from this very response.
        assertThat(response.getName()).isEqualTo("Margaret");
        assertThat(response.getCity()).isEqualTo("Montreal");
        assertThat(response.getTrustScore()).isEqualTo(40);
    }

    @Test
    void strangerView_hidesGender() {
        UUID targetId = UUID.randomUUID();
        UUID strangerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenNoConnection(strangerId, targetId);

        var response = profileService.getProfile(targetId, strangerId);

        // Gender is what turns a directory listing into a target list.
        assertThat(response.getGender()).isNull();
    }

    @Test
    void verifiedConnection_seesGender() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.HELPER);
        givenHelper(targetId, user, helperWithSocials(user));
        givenConnection(viewerId, targetId, ConnectionStatus.ACTIVE, TrustLevel.VERIFIED);

        var response = profileService.getProfile(targetId, viewerId);

        assertThat(response.getGender()).isEqualTo("MALE");
    }

    @Test
    void strangerView_stillSeesOccupation() {
        UUID targetId = UUID.randomUUID();
        UUID strangerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenNoConnection(strangerId, targetId);

        var response = profileService.getProfile(targetId, strangerId);

        // Deliberate: the website prints occupation in another user's profile
        // header, and "Retired schoolteacher" identifies nobody. Blanking it is a
        // product decision for the owner, not part of this security fix.
        assertThat(response.getOccupation()).isEqualTo("Retired schoolteacher");
    }
}
