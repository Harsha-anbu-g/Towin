package com.towinly.family.service;

import com.towinly.block.service.BlockService;
import com.towinly.common.entity.User;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.FamilyStandingState;
import com.towinly.common.enums.TrustLevel;
import com.towinly.common.service.S3Service;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.family.dto.FamilyStandingsResponse;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.entity.FamilyStandingControl;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.family.repository.FamilyStandingControlRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
    @Mock com.towinly.common.repository.UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock S3Service s3Service;
    @Mock BlockService blockService;
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

    // ── familyBehind: the helper's mirror of the same derivation ──

    private void linkSarahBehindMargaret() {
        lenient().when(familyLinkRepository.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(FamilyLink.builder()
                        .elder(margaret).familyUser(sarah).initiatedBy(sarah)
                        .relationship("Daughter").status(FamilyLinkStatus.ACTIVE).build()));
    }

    @Test
    void helperSeesFamilyBehindASharedFriendship() {
        when(connectionRepository.findByUserAndStatus(harsha.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        linkSarahBehindMargaret();

        var entries = service.familyBehind(harsha.getId()).getEntries();

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).getConnectionId()).isEqualTo(sharedConnection.getId());
        assertThat(entries.get(0).getElderName()).isEqualTo("Margaret");
        assertThat(entries.get(0).getFamilyName()).isEqualTo("Sarah");
        assertThat(entries.get(0).getRelationship()).isEqualTo("Daughter");
    }

    @Test
    void helperSeesNothingBehindAPrivateFriendship() {
        when(connectionRepository.findByUserAndStatus(harsha.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(connection(TrustLevel.TRUSTED, false)));
        linkSarahBehindMargaret();

        assertThat(service.familyBehind(harsha.getId()).getEntries()).isEmpty();
    }

    @Test
    void helperSeesNothingBelowMessaging() {
        when(connectionRepository.findByUserAndStatus(harsha.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(connection(TrustLevel.DISCOVERED, true)));
        linkSarahBehindMargaret();

        assertThat(service.familyBehind(harsha.getId()).getEntries()).isEmpty();
    }

    @Test
    void familyChatRowsDeriveNoFamilyBehindEntries() {
        Connection coordination = connection(TrustLevel.TRUSTED, true);
        coordination.setType(ConnectionType.FAMILY);
        when(connectionRepository.findByUserAndStatus(harsha.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(coordination));

        assertThat(service.familyBehind(harsha.getId()).getEntries()).isEmpty();
    }

    @Test
    void revokedStandingHidesTheFamilyMemberFromTheHelper() {
        when(connectionRepository.findByUserAndStatus(harsha.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        linkSarahBehindMargaret();
        when(controlRepository.findByFamilyUserIdAndElderConnectionId(sarah.getId(), sharedConnection.getId()))
                .thenReturn(Optional.of(FamilyStandingControl.builder()
                        .state(FamilyStandingState.REVOKED).build()));

        assertThat(service.familyBehind(harsha.getId()).getEntries()).isEmpty();
    }

    // ── HARD-106 / SEC-05: a block ends the bridge ──
    // isHidden is symmetric on the server (it asks whether EITHER person blocked
    // the other), so one stub covers both directions and no test duplicates them.

    private FamilyLink activeLinkMargaretSarah() {
        return FamilyLink.builder()
                .elder(margaret).familyUser(sarah).initiatedBy(sarah)
                .relationship("Daughter").status(FamilyLinkStatus.ACTIVE).build();
    }

    private void bothUsersResolve() {
        lenient().when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        lenient().when(userRepository.findById(harsha.getId())).thenReturn(Optional.of(harsha));
        lenient().when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        lenient().when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void standingsFor_dropsAHelperBlockedInEitherDirection() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        when(blockService.isHidden(sarah.getId(), harsha.getId())).thenReturn(true);

        assertThat(standings()).isEmpty();
    }

    @Test
    void familyBehind_dropsAFamilyMemberBlockedInEitherDirection() {
        when(connectionRepository.findByUserAndStatus(harsha.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        linkSarahBehindMargaret();
        when(blockService.isHidden(sarah.getId(), harsha.getId())).thenReturn(true);

        assertThat(service.familyBehind(harsha.getId()).getEntries()).isEmpty();
    }

    @Test
    void standingFor_derivesNothingAcrossABlock() {
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        when(blockService.isHidden(sarah.getId(), harsha.getId())).thenReturn(true);

        assertThat(service.standingFor(sarah.getId(), sharedConnection.getId())).isNull();
    }

    @Test
    void materializeChat_isRefusedAcrossABlock_soNoConnectionIsCreated() {
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        bothUsersResolve();
        when(blockService.isHidden(sarah.getId(), harsha.getId())).thenReturn(true);

        assertThatThrownBy(() -> service.materializeChat(sarah.getId(), sharedConnection.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(BlockService.NOT_AVAILABLE);
        verify(connectionRepository, never()).save(any(Connection.class));
    }

    @Test
    void materializeChat_doesNotReopenATerminalRowAcrossABlock() {
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        // The dead SOCIAL row the unblocked path reopens as FAMILY. Across a block
        // it must be left exactly as it is: half of it belongs to the blocked person.
        Connection declined = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.DECLINED)
                .currentTrustLevel(TrustLevel.DISCOVERED).initiatedBy(sarah).build();
        lenient().when(connectionRepository.findBetweenUsers(sarah.getId(), harsha.getId()))
                .thenReturn(Optional.of(declined));
        bothUsersResolve();
        when(blockService.isHidden(sarah.getId(), harsha.getId())).thenReturn(true);

        assertThatThrownBy(() -> service.materializeChat(sarah.getId(), sharedConnection.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(BlockService.NOT_AVAILABLE);
        assertThat(declined.getType()).isEqualTo(ConnectionType.SOCIAL);
        assertThat(declined.getStatus()).isEqualTo(ConnectionStatus.DECLINED);
        verify(connectionRepository, never()).save(any(Connection.class));
    }

    @Test
    void openFamilyMemberChat_isRefusedAcrossABlock() {
        // The family link still stands; the block closes the door anyway.
        // Lenient because familyLinkExists asks both seats and only one is stubbed.
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        bothUsersResolve();
        when(blockService.isHidden(sarah.getId(), margaret.getId())).thenReturn(true);

        assertThatThrownBy(() -> service.openFamilyMemberChat(sarah.getId(), margaret.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(BlockService.NOT_AVAILABLE);
        verify(connectionRepository, never()).save(any(Connection.class));
    }

    @Test
    void chatAllowed_isFalseAcrossABlock_soAnOpenFamilyChatStopsLoading() {
        Connection familyChat = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.FAMILY).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.DISCOVERED).initiatedBy(sarah).build();
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        when(familyLinkRepository.findByFamilyUserIdAndStatus(harsha.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of());
        when(blockService.isHidden(sarah.getId(), harsha.getId())).thenReturn(true);

        assertThat(service.chatAllowed(familyChat)).isFalse();
    }

    @Test
    void transparency_dropsABlockedStandingButKeepsTheChatTheFamilyAlreadyOpened() {
        // Locked rule: nothing family-facing is hidden from the elder. A chat their
        // daughter already opened stays on this page even across a block, because
        // the elder is a third party to it. The inherited standing goes, because
        // after the block it is no longer true that she can reach that helper.
        User devi = User.builder().id(UUID.randomUUID()).fullName("Devi").build();
        when(familyLinkRepository.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(activeLinkMargaretSarah()));
        Connection openedChat = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.FAMILY).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.DISCOVERED).initiatedBy(sarah).build();
        when(connectionRepository.findByUserAndStatus(sarah.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(openedChat));
        Connection sharedWithDevi = Connection.builder()
                .id(UUID.randomUUID()).userA(margaret).userB(devi)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.FIRST_MEET).sharedWithFamily(true)
                .initiatedBy(devi).build();
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedWithDevi));
        when(blockService.isHidden(sarah.getId(), devi.getId())).thenReturn(true);

        var rows = service.transparency(margaret.getId()).getConnections();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getHelperName()).isEqualTo("Harsha");
        assertThat(rows.get(0).isInherited()).isFalse();
    }
}
