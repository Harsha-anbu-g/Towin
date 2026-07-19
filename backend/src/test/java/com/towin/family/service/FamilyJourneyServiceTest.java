package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.NeedStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.dto.FamilyJourneyResponse;
import com.towin.family.dto.FamilyJourneyResponse.ElderJourney;
import com.towin.family.dto.FamilyJourneyResponse.SharedHelper;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.streak.entity.UserStreak;
import com.towin.streak.repository.UserStreakRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Step 2 US-001: family follows the parent's trust journey — SHARED connections
 * only, read-only, elder-level check-in + open-needs status.
 */
@ExtendWith(MockitoExtension.class)
class FamilyJourneyServiceTest {

    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock UserStreakRepository streakRepository;
    @Mock NeedRepository needRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock S3Service s3Service;

    FamilyJourneyService service;

    private User elder;
    private User familyUser;

    @BeforeEach
    void setUp() {
        service = new FamilyJourneyService(
                familyLinkRepository, connectionRepository, streakRepository,
                needRepository, elderProfileRepository, helperProfileRepository, s3Service);
        elder = buildUser("margaret_elder", UserRole.ELDER, 24.0);
        familyUser = buildUser("sarah_daughter", UserRole.FAMILY, 0.0);
        lenient().when(elderProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(helperProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(streakRepository.findByUserId(any())).thenReturn(Optional.empty());
    }

    private User buildUser(String username, UserRole role, double trustScore) {
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .email(username + "@test.com")
                .fullName(username.replace('_', ' '))
                .role(role)
                .trustScore(trustScore)
                .build();
    }

    private void linkActive(User theElder) {
        FamilyLink link = FamilyLink.builder()
                .id(UUID.randomUUID())
                .elder(theElder)
                .familyUser(familyUser)
                .initiatedBy(theElder)
                .status(FamilyLinkStatus.ACTIVE)
                .build();
        when(familyLinkRepository.findByFamilyUserIdAndStatus(familyUser.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(link));
    }

    private Connection connection(User a, User b, ConnectionStatus status,
                                  boolean shared, TrustLevel level) {
        return Connection.builder()
                .id(UUID.randomUUID())
                .userA(a).userB(b)
                .initiatedBy(a)
                .status(status)
                .sharedWithFamily(shared)
                .currentTrustLevel(level)
                .build();
    }

    // --- link gating ---

    @Test
    void emptyArrayWhenCallerHasNoActiveLinks() {
        when(familyLinkRepository.findByFamilyUserIdAndStatus(familyUser.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of());

        FamilyJourneyResponse response = service.getJourney(familyUser.getId());

        assertThat(response.getElders()).isEmpty();
    }

    @Test
    void oneEntryPerActiveLinkedElder() {
        linkActive(elder);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of());
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);

        FamilyJourneyResponse response = service.getJourney(familyUser.getId());

        assertThat(response.getElders()).hasSize(1);
        ElderJourney entry = response.getElders().get(0);
        assertThat(entry.getElderId()).isEqualTo(elder.getId());
        assertThat(entry.getElderName()).isEqualTo("margaret elder");
        assertThat(entry.getSharedHelpers()).isEmpty();
    }

    @Test
    void elderSeatMayBeRoleBoth() {
        User bothElder = buildUser("bob_both", UserRole.BOTH, 10.0);
        linkActive(bothElder);
        when(connectionRepository.findByUserAndStatus(bothElder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of());
        when(needRepository.countByElderIdAndStatus(bothElder.getId(), NeedStatus.OPEN)).thenReturn(0L);

        FamilyJourneyResponse response = service.getJourney(familyUser.getId());

        assertThat(response.getElders()).hasSize(1);
        assertThat(response.getElders().get(0).getElderId()).isEqualTo(bothElder.getId());
    }

    // --- share gating ---

    @Test
    void onlySharedActiveConnectionsAppear_privateOnesEntirelyAbsent() {
        linkActive(elder);
        User sharedHelper = buildUser("harry_helper", UserRole.HELPER, 30.0);
        User privateHelper = buildUser("paula_private", UserRole.HELPER, 12.0);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(
                        connection(elder, sharedHelper, ConnectionStatus.ACTIVE, true, TrustLevel.MESSAGING),
                        connection(elder, privateHelper, ConnectionStatus.ACTIVE, false, TrustLevel.TRUSTED)));
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);

        FamilyJourneyResponse response = service.getJourney(familyUser.getId());

        List<SharedHelper> helpers = response.getElders().get(0).getSharedHelpers();
        assertThat(helpers).hasSize(1);
        assertThat(helpers.get(0).getHelperName()).isEqualTo("harry helper");
    }

    @Test
    void sharedHelperCarriesScoreTierStageAndConnectionId() {
        linkActive(elder);
        User helper = buildUser("harry_helper", UserRole.HELPER, 47.0);
        Connection c = connection(elder, helper, ConnectionStatus.ACTIVE, true, TrustLevel.MESSAGING);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(c));
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);

        SharedHelper h = service.getJourney(familyUser.getId())
                .getElders().get(0).getSharedHelpers().get(0);

        assertThat(h.getConnectionId()).isEqualTo(c.getId());
        assertThat(h.getTrustScore()).isEqualTo(47);
        assertThat(h.getTier()).isEqualTo("Highly Trusted");
        assertThat(h.getStageIndex()).isEqualTo(TrustLevel.MESSAGING.getValue());
        assertThat(h.getStageLabel()).isEqualTo("Messaging");
        assertThat(h.isReadyToMeet()).isFalse();
    }

    // --- ready-to-meet flag ---

    @Test
    void readyToMeetIsTrueExactlyAtFirstMeet() {
        linkActive(elder);
        User helper = buildUser("harry_helper", UserRole.HELPER, 30.0);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(
                        connection(elder, helper, ConnectionStatus.ACTIVE, true, TrustLevel.FIRST_MEET)));
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);

        SharedHelper h = service.getJourney(familyUser.getId())
                .getElders().get(0).getSharedHelpers().get(0);

        assertThat(h.isReadyToMeet()).isTrue();
        assertThat(h.getStageLabel()).isEqualTo("Ready to Meet");
        assertThat(h.getStageIndex()).isEqualTo(TrustLevel.FIRST_MEET.getValue());
    }

    @Test
    void fullyTrustedIsNotReadyToMeet() {
        linkActive(elder);
        User helper = buildUser("harry_helper", UserRole.HELPER, 30.0);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(
                        connection(elder, helper, ConnectionStatus.ACTIVE, true, TrustLevel.TRUSTED)));
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);

        SharedHelper h = service.getJourney(familyUser.getId())
                .getElders().get(0).getSharedHelpers().get(0);

        assertThat(h.isReadyToMeet()).isFalse();
        assertThat(h.getStageLabel()).isEqualTo("Fully Trusted");
    }

    // --- elder-level status: check-in + open needs ---

    @Test
    void checkedInTodayTrueWhenLastCheckinIsToday() {
        linkActive(elder);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of());
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);
        when(streakRepository.findByUserId(elder.getId())).thenReturn(Optional.of(
                UserStreak.builder().userId(elder.getId()).lastCheckinDate(LocalDate.now()).build()));

        assertThat(service.getJourney(familyUser.getId())
                .getElders().get(0).isCheckedInToday()).isTrue();
    }

    @Test
    void checkedInTodayFalseWhenLastCheckinIsYesterdayOrMissing() {
        linkActive(elder);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of());
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);
        when(streakRepository.findByUserId(elder.getId())).thenReturn(Optional.of(
                UserStreak.builder().userId(elder.getId())
                        .lastCheckinDate(LocalDate.now().minusDays(1)).build()));

        assertThat(service.getJourney(familyUser.getId())
                .getElders().get(0).isCheckedInToday()).isFalse();
    }

    @Test
    void openNeedsCountComesFromOpenStatusOnly() {
        linkActive(elder);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of());
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(3L);

        assertThat(service.getJourney(familyUser.getId())
                .getElders().get(0).getOpenNeedsCount()).isEqualTo(3);
    }

    // --- photo presigning ---

    @Test
    void photoUrlsArePresignedWhenProfilePhotoExists() {
        linkActive(elder);
        User helper = buildUser("harry_helper", UserRole.HELPER, 30.0);
        when(connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(
                        connection(elder, helper, ConnectionStatus.ACTIVE, true, TrustLevel.MESSAGING)));
        when(needRepository.countByElderIdAndStatus(elder.getId(), NeedStatus.OPEN)).thenReturn(0L);
        com.towin.profile.entity.HelperProfile hp = new com.towin.profile.entity.HelperProfile();
        hp.setPhotoUrl("raw-photo-key");
        when(helperProfileRepository.findByUserId(helper.getId())).thenReturn(Optional.of(hp));
        when(s3Service.presignedUrl("raw-photo-key")).thenReturn("https://signed/photo");

        SharedHelper h = service.getJourney(familyUser.getId())
                .getElders().get(0).getSharedHelpers().get(0);

        assertThat(h.getHelperPhotoUrl()).isEqualTo("https://signed/photo");
    }
}
