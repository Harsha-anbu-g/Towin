package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.FamilyStandingState;
import com.towin.common.enums.TrustLevel;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.dto.FamilyStandingsResponse;
import com.towin.family.entity.FamilyLink;
import com.towin.family.entity.FamilyStandingControl;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.family.repository.FamilyStandingControlRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Trust inheritance derivation (user decisions 2026-07-19): fully automatic,
 * unlocks at MESSAGING, elder's share switch is the single consent gate,
 * family can pause or revoke on their side.
 */
@ExtendWith(MockitoExtension.class)
class FamilyStandingServiceTest {

    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyStandingControlRepository controlRepository;
    @Mock com.towin.common.repository.UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock S3Service s3Service;
    @InjectMocks FamilyStandingService service;

    private User sarah, margaret, harsha;
    private Connection sharedConnection;

    @BeforeEach
    void setUp() {
        sarah    = User.builder().id(UUID.randomUUID()).fullName("Sarah").build();
        margaret = User.builder().id(UUID.randomUUID()).fullName("Margaret").build();
        harsha   = User.builder().id(UUID.randomUUID()).fullName("Harsha").build();
        sharedConnection = connection(TrustLevel.FIRST_MEET, true);

        FamilyLink link = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(margaret).familyUser(sarah)
                .initiatedBy(sarah).status(FamilyLinkStatus.ACTIVE).build();
        lenient().when(familyLinkRepository.findByFamilyUserIdAndStatus(sarah.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(link));
        lenient().when(elderProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(helperProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(controlRepository.findByFamilyUserIdAndElderConnectionId(any(), any()))
                .thenReturn(Optional.empty());
        lenient().when(connectionRepository.findBetweenUsers(any(), any())).thenReturn(Optional.empty());
    }

    private Connection connection(TrustLevel level, boolean shared) {
        return Connection.builder()
                .id(UUID.randomUUID())
                .userA(margaret)
                .userB(harsha)
                .type(ConnectionType.SOCIAL)
                .status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(level)
                .sharedWithFamily(shared)
                .initiatedBy(harsha)
                .build();
    }

    private List<FamilyStandingsResponse.Standing> standings() {
        return service.standingsFor(sarah.getId()).getStandings();
    }

    @Test
    void sharedConnectionAtMessagingOrAboveGrantsStanding() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));

        List<FamilyStandingsResponse.Standing> result = standings();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getHelperName()).isEqualTo("Harsha");
        assertThat(result.get(0).getElderName()).isEqualTo("Margaret");
        assertThat(result.get(0).getStageLabel()).isEqualTo("Ready to Meet");
        assertThat(result.get(0).isPaused()).isFalse();
    }

    @Test
    void privateConnectionGrantsNothing() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(connection(TrustLevel.TRUSTED, false)));

        assertThat(standings()).isEmpty();
    }

    @Test
    void belowMessagingGrantsNothing() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(connection(TrustLevel.DISCOVERED, true)));

        assertThat(standings()).isEmpty();
    }

    @Test
    void eldersFamilyTypeConnectionsAreNotStandings() {
        Connection coordination = connection(TrustLevel.TRUSTED, true);
        coordination.setType(ConnectionType.FAMILY);
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(coordination));

        assertThat(standings()).isEmpty();
    }

    @Test
    void revokedControlHidesTheStanding() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        when(controlRepository.findByFamilyUserIdAndElderConnectionId(sarah.getId(), sharedConnection.getId()))
                .thenReturn(Optional.of(FamilyStandingControl.builder()
                        .state(FamilyStandingState.REVOKED).build()));

        assertThat(standings()).isEmpty();
    }

    @Test
    void pausedControlKeepsTheCardButMarksItPaused() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        when(controlRepository.findByFamilyUserIdAndElderConnectionId(sarah.getId(), sharedConnection.getId()))
                .thenReturn(Optional.of(FamilyStandingControl.builder()
                        .state(FamilyStandingState.PAUSED).build()));

        List<FamilyStandingsResponse.Standing> result = standings();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).isPaused()).isTrue();
    }

    @Test
    void materializedChatConnectionIsIncluded() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        Connection chat = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.FAMILY).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.DISCOVERED).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), harsha.getId()))
                .thenReturn(Optional.of(chat));

        List<FamilyStandingsResponse.Standing> result = standings();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getChatConnectionId()).isEqualTo(chat.getId());
    }

    @Test
    void transparencyShowsInheritedStandingsToTheElder() {
        when(familyLinkRepository.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(FamilyLink.builder().elder(margaret).familyUser(sarah)
                        .initiatedBy(sarah).relationship("Daughter")
                        .status(FamilyLinkStatus.ACTIVE).build()));
        when(connectionRepository.findByUserAndStatus(sarah.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of());
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));

        var result = service.transparency(margaret.getId());

        assertThat(result.getConnections()).hasSize(1);
        assertThat(result.getConnections().get(0).isInherited()).isTrue();
        assertThat(result.getConnections().get(0).getHelperName()).isEqualTo("Harsha");
        assertThat(result.getConnections().get(0).getRelationship()).isEqualTo("Daughter");
    }

    @Test
    void materializeChatNeverOverwritesAnExistingNonFamilyConnection() {
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(FamilyLink.builder()
                        .elder(margaret).familyUser(sarah).initiatedBy(sarah)
                        .status(FamilyLinkStatus.ACTIVE).build()));
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(harsha.getId(), sarah.getId()))
                .thenReturn(Optional.empty());
        // Sarah and Harsha already share a real SOCIAL connection — it must be
        // handed back untouched, not overwritten into a coordination chat.
        Connection social = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.TRUSTED).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), harsha.getId()))
                .thenReturn(Optional.of(social));
        lenient().when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        lenient().when(userRepository.findById(harsha.getId())).thenReturn(Optional.of(harsha));

        UUID chatId = service.materializeChat(sarah.getId(), sharedConnection.getId());

        assertThat(chatId).isEqualTo(social.getId());
        assertThat(social.getType()).isEqualTo(ConnectionType.SOCIAL);
        verify(connectionRepository, never()).save(any(Connection.class));
    }

    @Test
    void materializeChatReopensATerminalConnectionAsFamilyInsteadOfDeadEnding() {
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(FamilyLink.builder()
                        .elder(margaret).familyUser(sarah).initiatedBy(sarah)
                        .status(FamilyLinkStatus.ACTIVE).build()));
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(harsha.getId(), sarah.getId()))
                .thenReturn(Optional.empty());
        // A stale DECLINED social request between the pair must NOT be handed back
        // (send would reject a non-active connection) — it is reopened as FAMILY.
        Connection declined = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.DECLINED)
                .currentTrustLevel(TrustLevel.DISCOVERED).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), harsha.getId()))
                .thenReturn(Optional.of(declined));
        lenient().when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        lenient().when(userRepository.findById(harsha.getId())).thenReturn(Optional.of(harsha));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        service.materializeChat(sarah.getId(), sharedConnection.getId());

        assertThat(declined.getType()).isEqualTo(ConnectionType.FAMILY);
        assertThat(declined.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
    }

    @Test
    void chatAllowedIsFalseOnceTheSharedTrustBridgeIsGone() {
        // The read/send gate re-derives this on every access — no cached state.
        Connection familyChat = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.FAMILY).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.DISCOVERED).initiatedBy(sarah).build();
        // Margaret stopped sharing → no elder connection derives a standing.
        when(familyLinkRepository.findByFamilyUserIdAndStatus(sarah.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(FamilyLink.builder().elder(margaret).familyUser(sarah)
                        .initiatedBy(sarah).status(FamilyLinkStatus.ACTIVE).build()));
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(connection(TrustLevel.TRUSTED, false))); // shared = false
        when(familyLinkRepository.findByFamilyUserIdAndStatus(harsha.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of());

        assertThat(service.chatAllowed(familyChat)).isFalse();
    }

    @Test
    void standingForDerivesTheSameGateForOneConnection() {
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(FamilyLink.builder()
                        .elder(margaret).familyUser(sarah).initiatedBy(sarah)
                        .status(FamilyLinkStatus.ACTIVE).build()));
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(harsha.getId(), sarah.getId()))
                .thenReturn(Optional.empty());

        FamilyStandingsResponse.Standing s = service.standingFor(sarah.getId(), sharedConnection.getId());

        assertThat(s).isNotNull();
        assertThat(s.getHelperUserId()).isEqualTo(harsha.getId());
    }
}
