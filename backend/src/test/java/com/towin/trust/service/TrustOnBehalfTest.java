package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.DelegatedPower;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.service.SosService;
import com.towin.family.service.FamilyDelegationService;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.trust.dto.TrustStatusResponse;
import com.towin.trust.entity.TrustProgressionLog;
import com.towin.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guardian mode, power 3: Sarah moves her mother's trust ladder along for her.
 *
 * Margaret keeps the seat — the trust being built is genuinely hers, with her
 * helper, and it still takes both of them to agree — while Sarah is recorded in
 * the history as the one who pressed the button.
 */
@ExtendWith(MockitoExtension.class)
class TrustOnBehalfTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock TrustProgressionLogRepository trustLogRepository;
    @Mock UserRepository userRepository;
    @Mock SosService sosService;
    @Mock TrustScoreService trustScoreService;
    @Mock FamilyDelegationService familyDelegationService;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @InjectMocks TrustService trustService;

    private User margaret;   // the parent, and the elder seat on the ladder
    private User helper;
    private User sarah;      // her daughter, not on the connection at all
    private Connection connection;

    @BeforeEach
    void setUp() {
        margaret = User.builder().id(UUID.randomUUID()).username("margaret").role(UserRole.ELDER).build();
        helper = User.builder().id(UUID.randomUUID()).username("helper").role(UserRole.HELPER).build();
        sarah = User.builder().id(UUID.randomUUID()).username("sarah").role(UserRole.FAMILY).build();
        connection = Connection.builder()
                .id(UUID.randomUUID())
                .userA(margaret)
                .userB(helper)
                .status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.DISCOVERED)
                .sharedWithFamily(true)   // Margaret is Watching this friendship
                .build();
    }

    private void sarahMayAdvanceTrust(boolean may) {
        when(familyDelegationService.hasPowerOn(
                sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST, connection))
                .thenReturn(may);
    }

    private void connectionIsFound() {
        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
    }

    @Test
    void delegatedFamilyMemberTakesTheStepFromTheParentsSeat() {
        connectionIsFound();
        sarahMayAdvanceTrust(true);
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null);

        // Margaret's seat is the one that moved — Sarah did not add a third seat.
        assertThat(connection.isConfirmedByUser(margaret.getId())).isTrue();
        assertThat(connection.isConfirmedByUser(helper.getId())).isFalse();
        verify(trustLogRepository, never()).save(any());  // the helper hasn't agreed yet
    }

    @Test
    void theHistoryCreditsTheParentAndNamesTheFamilyMemberWhoPressedTheButton() {
        connection.setConfirmedByUser(helper.getId(), true);  // the helper already agreed
        connectionIsFound();
        sarahMayAdvanceTrust(true);
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null);

        ArgumentCaptor<TrustProgressionLog> logged = ArgumentCaptor.forClass(TrustProgressionLog.class);
        verify(trustLogRepository).save(logged.capture());
        assertThat(logged.getValue().getConfirmedBy().getId()).isEqualTo(margaret.getId());
        assertThat(logged.getValue().getActedBy().getId()).isEqualTo(sarah.getId());
        assertThat(connection.getCurrentTrustLevel()).isEqualTo(TrustLevel.DISCOVERED.next());
    }

    @Test
    void theHistoryRemembersTheFamilyMemberEvenThoughTheHelperFinishedTheStep() {
        // The normal shape of a delegated step, and the one that used to vanish:
        // Margaret starts it (Sarah pressing for her) and the helper agrees later.
        // The history row is only written on the helper's reply, so unless Sarah is
        // carried across the two presses she disappears from it completely — the
        // step ends up looking like Margaret took it herself.
        connectionIsFound();
        sarahMayAdvanceTrust(true);
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null);   // Sarah, for Margaret
        verify(trustLogRepository, never()).save(any());
        assertThat(connection.getConfirmActedByUser(margaret.getId()).getId()).isEqualTo(sarah.getId());

        trustService.confirmTrustLevel(helper.getId(), connection.getId(), null);  // the helper agrees

        ArgumentCaptor<TrustProgressionLog> logged = ArgumentCaptor.forClass(TrustProgressionLog.class);
        verify(trustLogRepository).save(logged.capture());
        assertThat(logged.getValue().getConfirmedBy().getId()).isEqualTo(helper.getId());
        assertThat(logged.getValue().getActedBy().getId()).isEqualTo(sarah.getId());
        // ...and the stand-in is cleared with the flags, so the NEXT step starts clean.
        assertThat(connection.getConfirmActedByUser(margaret.getId())).isNull();
        assertThat(connection.getConfirmActedByUser(helper.getId())).isNull();
    }

    @Test
    void aParentTakingTheirOwnStepWipesAnEarlierStandIn() {
        // Sarah pressed for Margaret on a step that never finished. If that stamp
        // survived, the next step — one Margaret took entirely by herself — would
        // name Sarah for something she had no part in.
        connection.setConfirmActedByUser(margaret.getId(), sarah);
        connection.setConfirmedByUser(helper.getId(), true);
        connectionIsFound();
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        trustService.confirmTrustLevel(margaret.getId(), connection.getId(), null);

        ArgumentCaptor<TrustProgressionLog> logged = ArgumentCaptor.forClass(TrustProgressionLog.class);
        verify(trustLogRepository).save(logged.capture());
        assertThat(logged.getValue().getActedBy()).isNull();
    }

    @Test
    void theTrustScreenIsToldWhoTookTheStep() {
        // Stamping it in the history is only half the promise — it has to reach the
        // screen, or the person reading it still sees a step nobody helped with.
        connectionIsFound();
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of(TrustProgressionLog.builder()
                        .fromLevel(TrustLevel.DISCOVERED)
                        .toLevel(TrustLevel.DISCOVERED.next())
                        .confirmedBy(margaret)
                        .actedBy(sarah)
                        .build()));
        when(elderProfileRepository.findByUserId(sarah.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Sarah").build()));

        TrustStatusResponse status = trustService.getStatus(margaret.getId(), connection.getId());

        assertThat(status.getHistory()).hasSize(1);
        assertThat(status.getHistory().get(0).getActedByName()).isEqualTo("Sarah");
        assertThat(status.getHistory().get(0).getActedByUserId()).isEqualTo(sarah.getId());
    }

    @Test
    void aStepEveryoneTookThemselvesNamesNobody() {
        connectionIsFound();
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of(TrustProgressionLog.builder()
                        .fromLevel(TrustLevel.DISCOVERED)
                        .toLevel(TrustLevel.DISCOVERED.next())
                        .confirmedBy(margaret)
                        .build()));

        TrustStatusResponse status = trustService.getStatus(margaret.getId(), connection.getId());

        assertThat(status.getHistory().get(0).getActedByName()).isNull();
        assertThat(status.getHistory().get(0).getActedByUserId()).isNull();
    }

    @Test
    void familyMemberWithoutThePowerIsNotPartOfTheParentsConnection() {
        connectionIsFound();
        when(familyDelegationService.hasPowerOn(any(), any(), eq(DelegatedPower.ADVANCE_TRUST), any()))
                .thenReturn(false);

        assertThatThrownBy(() -> trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not part of this connection");
        verify(connectionRepository, never()).save(any());
    }

    @Test
    void theParentTakingTheirOwnStepIsUnchangedAndNothingIsStamped() {
        connection.setConfirmedByUser(helper.getId(), true);
        connectionIsFound();
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        trustService.confirmTrustLevel(margaret.getId(), connection.getId(), null);

        ArgumentCaptor<TrustProgressionLog> logged = ArgumentCaptor.forClass(TrustProgressionLog.class);
        verify(trustLogRepository).save(logged.capture());
        assertThat(logged.getValue().getConfirmedBy().getId()).isEqualTo(margaret.getId());
        assertThat(logged.getValue().getActedBy()).isNull();
        // Someone already on the connection is only ever themselves — no lookup needed.
        verify(familyDelegationService, never()).hasPowerOn(any(), any(), any(), any());
    }

    @Test
    void thePowerIsRecheckedSoRevokingItStopsTheNextStep() {
        connectionIsFound();
        when(familyDelegationService.hasPowerOn(
                sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST, connection))
                .thenReturn(true)      // granted for the first step
                .thenReturn(false);    // Margaret takes it back straight after
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null);

        connection.setConfirmedByUser(margaret.getId(), false);  // a fresh step to take
        assertThatThrownBy(() -> trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not part of this connection");
        verify(connectionRepository).save(any());  // only the first step landed
    }

    @Test
    void theFamilyMemberCannotConfirmTwiceInTheParentsName() {
        // The "you already agreed" guard has to be judged on the parent's seat. If it
        // were judged on Sarah, she would look like a fresh pair of hands every time
        // and could walk the ladder up on her own.
        connection.setConfirmedByUser(margaret.getId(), true);
        connectionIsFound();
        sarahMayAdvanceTrust(true);

        assertThatThrownBy(() -> trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already confirmed");
        verify(connectionRepository, never()).save(any());
    }

    @Test
    void advancingTrustDoesNotReachTheParentsPauseButton() {
        // Pausing is not one of the four powers. ADVANCE_TRUST must not quietly grow
        // into the ability to pause or resume the parent's connection.
        connectionIsFound();

        assertThatThrownBy(() -> trustService.pauseProgression(sarah.getId(), connection.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not part of this connection");
        verify(familyDelegationService, never()).hasPowerOn(any(), any(), any(), any());
    }

    @Test
    void advancingTrustIsNotAskedAboutAnyOtherPower() {
        connectionIsFound();
        sarahMayAdvanceTrust(true);
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId()))
                .thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        trustService.confirmTrustLevel(sarah.getId(), connection.getId(), null);

        verify(familyDelegationService, never())
                .hasPowerOn(any(), any(), eq(DelegatedPower.MANAGE_HELP_REQUESTS), any());
        verify(familyDelegationService, never())
                .hasPowerOn(any(), any(), eq(DelegatedPower.LEAVE_REVIEWS), any());
    }
}
