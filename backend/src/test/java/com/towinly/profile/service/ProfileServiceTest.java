package com.towinly.profile.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import com.towinly.profile.dto.ElderProfileRequest;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.block.service.BlockService;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.Gender;
import com.towinly.common.enums.TrustLevel;
import com.towinly.connection.entity.Connection;
import com.towinly.profile.entity.HelperProfile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.IncorrectResultSizeDataAccessException;
import java.util.List;
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
    @Mock BlockService blockService;
    @Mock com.towinly.profile.security.PhoneChangeRateLimiter phoneChangeRateLimiter;
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

    /** An ordinary friendship row. Connection.type defaults to SOCIAL. */
    private Connection connection(ConnectionStatus status, TrustLevel level) {
        return Connection.builder().status(status).currentTrustLevel(level).build();
    }

    /** A FAMILY-typed row: the coordination chat, which earns no trust of its own. */
    private Connection familyConnection(ConnectionStatus status, TrustLevel level) {
        return Connection.builder().type(ConnectionType.FAMILY).status(status).currentTrustLevel(level).build();
    }

    private void givenConnection(UUID viewerId, UUID targetId, ConnectionStatus status, TrustLevel level) {
        givenConnections(viewerId, targetId, connection(status, level));
    }

    /** Every row the table holds for this pair. Two is a legitimate number; see below. */
    private void givenConnections(UUID viewerId, UUID targetId, Connection... rows) {
        when(connectionRepository.findAllBetweenUsers(viewerId, targetId)).thenReturn(List.of(rows));
    }

    private void givenNoConnection(UUID viewerId, UUID targetId) {
        when(connectionRepository.findAllBetweenUsers(viewerId, targetId)).thenReturn(List.of());
    }

    /**
     * A block standing between two people. BlockService.isHidden is symmetric - true when
     * either one blocked the other - so the stub answers symmetrically too. Without that
     * a direction test would only be pinning the argument order this service happens to
     * use, not the behaviour a real block produces.
     */
    private void givenBlockBetween(UUID one, UUID other) {
        when(blockService.isHidden(any(), any())).thenAnswer(call -> {
            UUID a = call.getArgument(0);
            UUID b = call.getArgument(1);
            return (a.equals(one) && b.equals(other)) || (a.equals(other) && b.equals(one));
        });
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
        verify(connectionRepository, never()).findAllBetweenUsers(any(), any());
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
    void blockedPairAtTrusted_refusesTheWholeRead() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        user.setCity("Montreal");
        when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
        givenBlockBetween(viewerId, targetId);

        // Supersedes the SEC-06 version of this case, which asserted a 200 carrying the
        // public card. That was written before the read had a block gate at all, and it
        // left the name, city, photo and trust score flowing to a blocked person while
        // the family screens had already dropped their card. The handles are still gone,
        // now because nothing comes back at all.
        assertThatThrownBy(() -> profileService.getProfile(targetId, viewerId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(BlockService.NOT_AVAILABLE);
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

    // ── R2-PROF: two rows for one pair, the block gate, family-typed connections ──

    @Test
    void twoRowsForOnePair_answerTheProfileInsteadOfCrashing() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));

        // Two rows for one pair is an ordinary user flow, not an attack: sendRequest
        // inserts (sender, target) without normalising the seats and only reuses a row
        // it finds PENDING or ACTIVE, so a decline followed by a request from the other
        // person leaves both (H,E) and (E,H) in the table. Read through an
        // Optional-returning finder that is exactly what Spring Data throws, and
        // GET /api/profile/{id} was a 500 for that pair from then on.
        lenient().when(connectionRepository.findBetweenUsers(viewerId, targetId))
                .thenThrow(new IncorrectResultSizeDataAccessException(1, 2));
        givenConnections(viewerId, targetId,
                connection(ConnectionStatus.DECLINED, TrustLevel.DISCOVERED),
                connection(ConnectionStatus.ACTIVE, TrustLevel.VERIFIED));

        var response = profileService.getProfile(targetId, viewerId);

        assertThat(response.getName()).isEqualTo("Margaret");
        // The live row is the answer. A stale declined row must not shut a real
        // friendship out of what it has earned.
        assertThat(response.getFacebookUrl()).isEqualTo(FACEBOOK);
        assertThat(response.getInstagramUrl()).isEqualTo(INSTAGRAM);
    }

    @Test
    void twoTerminalRowsForOnePair_answerTheProfileWithNoSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnections(viewerId, targetId,
                connection(ConnectionStatus.DECLINED, TrustLevel.TRUSTED),
                connection(ConnectionStatus.ENDED, TrustLevel.TRUSTED));

        var response = profileService.getProfile(targetId, viewerId);

        // Tolerating two rows must not become "any row will do": neither is live.
        assertThat(response.getName()).isEqualTo("Margaret");
        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
    }

    @Test
    void aViewerWhoBlockedTheOwner_cannotReadTheProfileAtAll() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
        givenBlockBetween(viewerId, targetId);

        assertThatThrownBy(() -> profileService.getProfile(targetId, viewerId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(BlockService.NOT_AVAILABLE);
    }

    @Test
    void anOwnerWhoBlockedTheViewer_closesTheProfileTheSameWay() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.HELPER);
        when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
        givenBlockBetween(targetId, viewerId);

        // The other direction. Both are refused with the same sentence, which names no
        // block: the blocked person is never told.
        assertThatThrownBy(() -> profileService.getProfile(targetId, viewerId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(BlockService.NOT_AVAILABLE);
    }

    @Test
    void aRefusedReadNeverLoadsTheProfileItRefuses() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
        givenBlockBetween(viewerId, targetId);

        assertThatThrownBy(() -> profileService.getProfile(targetId, viewerId))
                .isInstanceOf(IllegalStateException.class);

        // Nothing about the person is read, so nothing about them can leak into a log
        // line or a later refactor of the response.
        verify(elderProfileRepository, never()).findByUserId(any());
        verify(helperProfileRepository, never()).findByUserId(any());
        verify(connectionRepository, never()).findAllBetweenUsers(any(), any());
    }

    @Test
    void aBlockBetweenTwoOtherPeople_neverClosesAFamilyMembersRead() {
        UUID helperId = UUID.randomUUID();
        UUID elderId = UUID.randomUUID();
        UUID familyMemberId = UUID.randomUUID();
        User helperUser = subject(helperId, UserRole.HELPER);
        givenHelper(helperId, helperUser, helperWithSocials(helperUser));
        // The elder and the helper blocked each other. The family member is a third
        // party to that block.
        givenBlockBetween(elderId, helperId);
        givenNoConnection(familyMemberId, helperId);

        var response = profileService.getProfile(helperId, familyMemberId);

        // A block cuts contact between the two people in it. It must never become a way
        // to switch off somebody else's oversight: the daughter watching over her
        // mother still reads the helper who comes to the house.
        assertThat(response.getName()).isEqualTo("James");
        assertThat(response.getTrustScore()).isEqualTo(40);
    }

    @Test
    void aFamilyTypedConnectionAtVerified_stillHidesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnections(viewerId, targetId, familyConnection(ConnectionStatus.ACTIVE, TrustLevel.VERIFIED));

        var response = profileService.getProfile(targetId, viewerId);

        // A coordination chat is not a friendship, exactly as
        // PassOnVisibilityService.hasFullyTrustedFriendship already reads it.
        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
        assertThat(response.getGender()).isNull();
    }

    @Test
    void aResurrectedFamilyChatCarriesItsOldLevelAndStillHidesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.HELPER);
        givenHelper(targetId, user, helperWithSocials(user));
        givenConnections(viewerId, targetId, familyConnection(ConnectionStatus.ACTIVE, TrustLevel.TRUSTED));

        var response = profileService.getProfile(targetId, viewerId);

        // This is how a FAMILY row gets above VERIFIED, and it is why the type filter
        // has to exist. FamilyStandingService.openHelperChat and openFamilyMemberChat
        // reopen a terminal row by stamping it FAMILY and ACTIVE, and they set the trust
        // level only when it is null - so a friendship that once reached TRUSTED comes
        // back as a coordination chat still holding TRUSTED.
        assertThat(response.getFacebookUrl()).isNull();
        assertThat(response.getInstagramUrl()).isNull();
        assertThat(response.getGender()).isNull();
    }

    @Test
    void aRealFriendshipAlongsideAFamilyRow_stillReleasesSocials() {
        UUID targetId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        User user = subject(targetId, UserRole.ELDER);
        givenElder(targetId, user, elderWithSocials(user));
        givenConnections(viewerId, targetId,
                familyConnection(ConnectionStatus.ACTIVE, TrustLevel.TRUSTED),
                connection(ConnectionStatus.ACTIVE, TrustLevel.VERIFIED));

        var response = profileService.getProfile(targetId, viewerId);

        // Skipping FAMILY rows must not cost a pair the friendship they actually built.
        assertThat(response.getFacebookUrl()).isEqualTo(FACEBOOK);
        assertThat(response.getInstagramUrl()).isEqualTo(INSTAGRAM);
    }
}
