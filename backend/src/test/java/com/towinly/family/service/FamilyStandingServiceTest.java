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
import java.util.Set;
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
    void standingsFor_keepsAHelperBlockedByOrAgainstTheFamilyMember() {
        // R3-FAM item 1: oversight of a shared helper is not a contact list. A helper
        // who blocks the daughter (or whom she blocks) stays on her standings, exactly
        // as they stay on the journey screen. Cutting their contact is handled where
        // contact happens (materializeChat/chatAllowed), never by blanking this view.
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));

        assertThat(standings()).hasSize(1);
    }

    @Test
    void familyBehind_keepsAFamilyMemberBlockedByOrAgainstTheHelper() {
        // The same rule from the helper's seat: the family member who watches over the
        // shared elder stays on the helper's behind-me list even across a block. The
        // block cuts their contact, not the helper's awareness of who can watch.
        when(connectionRepository.findByUserAndStatus(harsha.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        linkSarahBehindMargaret();

        assertThat(service.familyBehind(harsha.getId()).getEntries()).hasSize(1);
    }

    @Test
    void standingFor_stillDerivesAcrossABlock_becauseContactIsGatedElsewhere() {
        // standingFor is the single-connection derivation behind the view. It no longer
        // returns null across a block: the helper stays visible, and the block is
        // enforced at the doors (materializeChat, chatAllowed), not in the derivation.
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));

        assertThat(service.standingFor(sarah.getId(), sharedConnection.getId())).isNotNull();
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
        // The send gate is where the family↔helper block is now enforced: the two on
        // the chat are exactly the pair the block stands between, so it shuts here even
        // while the standing above stays visible. Checked up front, before any bridge.
        Connection familyChat = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.FAMILY).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.DISCOVERED).initiatedBy(sarah).build();
        when(blockService.isHidden(sarah.getId(), harsha.getId())).thenReturn(true);

        assertThat(service.chatAllowed(familyChat)).isFalse();
    }

    @Test
    void transparency_keepsAnInheritedStandingAcrossABlock_nothingIsHiddenFromTheElder() {
        // Locked rule: nothing family-facing is hidden from the elder, and R3-FAM item
        // 1: a block never blanks oversight. A chat the daughter opened stays (the elder
        // is a third party to it), AND the inherited standing stays too — after the
        // block it is STILL true that the standing exists, only contact is cut.
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

        var rows = service.transparency(margaret.getId()).getConnections();

        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(r -> r.getHelperName()).contains("Harsha", "Devi");
    }

    // ── Round two: the block hides the pair it stands between, not a third party ──

    @Test
    void standingsFor_dropsAParentTheFamilyMemberBlocked() {
        // The list streams the parent's name, their helper roster and each helper's
        // live trust stage. When those two have blocked each other, none of it goes.
        when(blockService.hiddenFor(sarah.getId())).thenReturn(Set.of(margaret.getId()));

        assertThat(standings()).isEmpty();
        verify(connectionRepository, never()).findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE);
    }

    @Test
    void standingsFor_keepsTheParentWhenTheBlockIsWithSomebodyElse() {
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(sharedConnection));
        when(blockService.hiddenFor(sarah.getId())).thenReturn(Set.of(UUID.randomUUID()));

        assertThat(standings()).hasSize(1);
    }

    // ── A rung belongs to the relationship that earned it ──
    // ConnectionService.sendRequest stands a brand-new request at Phone Ready for a
    // sender scoring 51+, and at Social Media for 71+. Flipping such a row ACTIVE
    // without resetting it would hand over the phone number (SEC-02) or the social
    // handles (SEC-06) with no ladder step, and even after an explicit decline.

    @Test
    void materializeChat_reopensADeadRowAtTheBottomOfTheLadder() {
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        Connection declined = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.DECLINED)
                .currentTrustLevel(TrustLevel.PHONE_CALL).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), harsha.getId()))
                .thenReturn(Optional.of(declined));
        bothUsersResolve();

        service.materializeChat(sarah.getId(), sharedConnection.getId());

        assertThat(declined.getType()).isEqualTo(ConnectionType.FAMILY);
        assertThat(declined.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
        assertThat(declined.getCurrentTrustLevel()).isEqualTo(TrustLevel.DISCOVERED);
    }

    @Test
    void openFamilyMemberChat_keepsTheEarnedRungWhenReopeningARowThatWasReallyActive() {
        // R3-FAM item 5 / shared rule: an ENDED row was genuinely ACTIVE once, so it
        // keeps the rung the pair actually climbed. Resetting a real, since-ended
        // friendship would silently drop that person out of the family's standing.
        // Lenient because familyLinkExists asks both seats and only one is stubbed.
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        Connection ended = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(margaret)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.ENDED)
                .currentTrustLevel(TrustLevel.VERIFIED).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), margaret.getId()))
                .thenReturn(Optional.of(ended));
        bothUsersResolve();

        service.openFamilyMemberChat(sarah.getId(), margaret.getId());

        assertThat(ended.getType()).isEqualTo(ConnectionType.FAMILY);
        assertThat(ended.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
        assertThat(ended.getCurrentTrustLevel()).isEqualTo(TrustLevel.VERIFIED);
    }

    @Test
    void openFamilyMemberChat_resetsANeverActiveRowToTheBottom() {
        // A DECLINED row was never a real connection — only ever a granted head start,
        // and here explicitly refused — so it restarts at DISCOVERED, dropping any
        // head-start rung it carried.
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        Connection declined = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(margaret)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.DECLINED)
                .currentTrustLevel(TrustLevel.VERIFIED).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), margaret.getId()))
                .thenReturn(Optional.of(declined));
        bothUsersResolve();

        service.openFamilyMemberChat(sarah.getId(), margaret.getId());

        assertThat(declined.getCurrentTrustLevel()).isEqualTo(TrustLevel.DISCOVERED);
    }

    @Test
    void materializeChat_keepsTheEarnedRungWhenReopeningAnEndedFriendship() {
        // The pair had a real, since-ended friendship (VERIFIED). Reopening the family
        // chat keeps that earned rung — only never-active rows restart at the bottom.
        // The same rule as openFamilyMemberChat, applied here so the two cannot diverge.
        when(connectionRepository.findById(sharedConnection.getId()))
                .thenReturn(Optional.of(sharedConnection));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        Connection ended = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(harsha)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.ENDED)
                .currentTrustLevel(TrustLevel.VERIFIED).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), harsha.getId()))
                .thenReturn(Optional.of(ended));
        bothUsersResolve();

        service.materializeChat(sarah.getId(), sharedConnection.getId());

        assertThat(ended.getType()).isEqualTo(ConnectionType.FAMILY);
        assertThat(ended.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
        assertThat(ended.getCurrentTrustLevel()).isEqualTo(TrustLevel.VERIFIED);
    }

    @Test
    void openFamilyMemberChat_leavesTheRungOfTheChatTheyAlreadyHaveOpen() {
        // Only a row that has to be brought back from the dead starts again. A
        // live family chat keeps every step the two of them climbed together.
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(activeLinkMargaretSarah()));
        Connection live = Connection.builder()
                .id(UUID.randomUUID()).userA(sarah).userB(margaret)
                .type(ConnectionType.FAMILY).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.MESSAGING).initiatedBy(sarah).build();
        when(connectionRepository.findBetweenUsers(sarah.getId(), margaret.getId()))
                .thenReturn(Optional.of(live));
        bothUsersResolve();

        service.openFamilyMemberChat(sarah.getId(), margaret.getId());

        assertThat(live.getCurrentTrustLevel()).isEqualTo(TrustLevel.MESSAGING);
    }
}
