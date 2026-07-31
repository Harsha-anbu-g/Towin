package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.repository.UserRepository;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.dto.KeyholderAskResponse;
import com.towinly.passon.dto.KeyholderResponse;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnOpen;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Keyholders are the one relationship in Towinly that is about somebody's death, so the two
 * rules that keep it honest are tested here before anything else.
 *
 * <p><b>Nobody is conscripted.</b> A row starts INVITED and only the invited person moves it
 * to ACTIVE. The elder cannot accept on their behalf, and anyone who has said yes can step
 * back out again at any time.
 *
 * <p><b>Membership is re-derived, never snapshotted.</b> Holding a key means being ACTIVE
 * <em>and</em> still on the elder's family list, worked out on the spot on every single read.
 * A stored count would keep counting a daughter who unlinked herself last night, and the
 * number of people who must agree is the whole lock.
 *
 * <p>The third rule is an asymmetry that is easy to mistake for an oversight and must not be
 * "tidied up": asking somebody new tells the whole family, and taking somebody's key away
 * tells nobody at all. An elder who has realised a relative is leaning on her has to be able
 * to take that person's key back without the app announcing it to them.
 */
@ExtendWith(MockitoExtension.class)
class KeyholderServiceTest {

    /** 5 August 2026. Seven days later is 12 August — the same day the spec uses. */
    private static final Instant TODAY = Instant.parse("2026-08-05T10:00:00Z");

    @Mock KeyholderRepository keyholders;
    @Mock FamilyLinkRepository familyLinks;
    @Mock PassOnSettingsRepository settings;
    @Mock PassOnOpenRepository opens;
    @Mock UserRepository users;
    @Mock ElderProfileRepository elderProfiles;
    @Mock HelperProfileRepository helperProfiles;
    @Mock PassOnAlertService alerts;

    private Clock clock;
    private KeyholderService service;

    private User margaret;
    private User sarah;
    private User david;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(TODAY, ZoneOffset.UTC);
        service = new KeyholderService(keyholders, familyLinks, settings, opens, users,
                elderProfiles, helperProfiles, alerts, clock);

        margaret = person("Margaret");
        sarah = person("Sarah");
        david = person("David");

        lenient().when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        lenient().when(users.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        lenient().when(users.findById(david.getId())).thenReturn(Optional.of(david));
        lenient().when(elderProfiles.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(helperProfiles.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(keyholders.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    // ── INVITED: the start, and who may be asked ──

    @Test
    void anInviteStartsAtInvitedAndNobodyIsConscripted() {
        onFamilyList(sarah);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.empty());
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of());

        KeyholderResponse asked = service.invite(margaret.getId(), sarah.getId());

        assertThat(asked.status()).isEqualTo(KeyholderStatus.INVITED);
        assertThat(asked.countsToward()).isFalse();
    }

    @Test
    void onlyPeopleOnTheFamilyListCanBeAsked() {
        when(familyLinks.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.invite(margaret.getId(), sarah.getId()))
                .hasMessage(KeyholderService.FAMILY_ONLY);
        verify(keyholders, never()).save(any());
    }

    @Test
    void aFamilyLinkThatHasNotBeenAcceptedYetIsNotAFamilyList() {
        when(familyLinks.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link(margaret, sarah, FamilyLinkStatus.PENDING)));

        assertThatThrownBy(() -> service.invite(margaret.getId(), sarah.getId()))
                .hasMessage(KeyholderService.FAMILY_ONLY);
    }

    @Test
    void theSamePersonCannotBeAskedTwice() {
        onFamilyList(sarah);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(row(sarah, KeyholderStatus.INVITED)));

        assertThatThrownBy(() -> service.invite(margaret.getId(), sarah.getId()))
                .hasMessage(KeyholderService.ALREADY_ASKED);
    }

    @Test
    void somebodyWhoSaidNoCanBeAskedAgain() {
        onFamilyList(sarah);
        Keyholder declined = row(sarah, KeyholderStatus.DECLINED);
        declined.setRespondedAt(LocalDateTime.now(clock).minusDays(30));
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(declined));
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of(declined));

        KeyholderResponse asked = service.invite(margaret.getId(), sarah.getId());

        assertThat(asked.status()).isEqualTo(KeyholderStatus.INVITED);
        assertThat(declined.getRespondedAt()).isNull();
    }

    // ── INVITED -> ACTIVE | DECLINED ──

    @Test
    void onlyTheInvitedPersonCanAccept() {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholders.findById(asked.getId())).thenReturn(Optional.of(asked));

        // Margaret trying to say yes on Sarah's behalf is the whole thing this prevents.
        assertThatThrownBy(() -> service.respond(margaret.getId(), asked.getId(), true))
                .hasMessage(KeyholderService.NOT_YOURS);
        assertThat(asked.getStatus()).isEqualTo(KeyholderStatus.INVITED);
    }

    @Test
    void sayingYesMovesInvitedToActive() {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholders.findById(asked.getId())).thenReturn(Optional.of(asked));

        service.respond(sarah.getId(), asked.getId(), true);

        assertThat(asked.getStatus()).isEqualTo(KeyholderStatus.ACTIVE);
        assertThat(asked.getRespondedAt()).isEqualTo(LocalDateTime.now(clock));
    }

    @Test
    void sayingNoMovesInvitedToDeclined() {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholders.findById(asked.getId())).thenReturn(Optional.of(asked));

        service.respond(sarah.getId(), asked.getId(), false);

        assertThat(asked.getStatus()).isEqualTo(KeyholderStatus.DECLINED);
    }

    @Test
    void anAnsweredInviteCannotBeAnsweredAgain() {
        Keyholder alreadyIn = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findById(alreadyIn.getId())).thenReturn(Optional.of(alreadyIn));

        assertThatThrownBy(() -> service.respond(sarah.getId(), alreadyIn.getId(), false))
                .hasMessage(KeyholderService.ALREADY_ANSWERED);
    }

    @Test
    void sayingYesIsWrittenIntoTheElderSOwnRecord() {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholders.findById(asked.getId())).thenReturn(Optional.of(asked));

        service.respond(sarah.getId(), asked.getId(), true);

        assertThat(recordedKinds()).containsExactly(PassOnOpenKind.KEYHOLDER_ACCEPTED);
    }

    // ── ACTIVE -> RESIGNED | REMOVED | ENDED ──

    @Test
    void aKeyholderMayStepBackOutAtAnyTime() {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findById(holding.getId())).thenReturn(Optional.of(holding));

        service.resign(sarah.getId(), holding.getId());

        assertThat(holding.getStatus()).isEqualTo(KeyholderStatus.RESIGNED);
        assertThat(recordedKinds()).containsExactly(PassOnOpenKind.KEYHOLDER_RESIGNED);
    }

    @Test
    void theElderTakingAKeyBackMovesActiveToRemoved() {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByIdAndOwnerId(holding.getId(), margaret.getId()))
                .thenReturn(Optional.of(holding));

        service.remove(margaret.getId(), holding.getId());

        assertThat(holding.getStatus()).isEqualTo(KeyholderStatus.REMOVED);
    }

    @Test
    void aKeyThatIsAlreadyGoneCannotBeTakenBackTwice() {
        Keyholder gone = row(sarah, KeyholderStatus.RESIGNED);
        when(keyholders.findByIdAndOwnerId(gone.getId(), margaret.getId()))
                .thenReturn(Optional.of(gone));

        assertThatThrownBy(() -> service.remove(margaret.getId(), gone.getId()))
                .hasMessage(KeyholderService.NO_LONGER_HOLDING);
        assertThat(gone.getStatus()).isEqualTo(KeyholderStatus.RESIGNED);
    }

    @Test
    void anInviteCanBeWithdrawnBeforeItIsAnswered() {
        Keyholder waiting = row(sarah, KeyholderStatus.INVITED);
        when(keyholders.findByIdAndOwnerId(waiting.getId(), margaret.getId()))
                .thenReturn(Optional.of(waiting));

        service.remove(margaret.getId(), waiting.getId());

        assertThat(waiting.getStatus()).isEqualTo(KeyholderStatus.REMOVED);
        verifyNoInteractions(alerts);
    }

    @Test
    void somebodyElseSKeyholderCannotBeRemoved() {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByIdAndOwnerId(holding.getId(), david.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.remove(david.getId(), holding.getId()))
                .hasMessage(KeyholderService.NOT_FOUND);
    }

    // ── Step 2: the family link ends, so the key ends with it ──

    @Test
    void endingAFamilyLinkMovesThatKeyholderToEnded() {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(holding));

        service.onFamilyLinkEnded(margaret.getId(), sarah.getId());

        assertThat(holding.getStatus()).isEqualTo(KeyholderStatus.ENDED);
    }

    @Test
    void endingAFamilyLinkTellsTheElderOnHerOwnRecord() {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(holding));

        service.onFamilyLinkEnded(margaret.getId(), sarah.getId());

        ArgumentCaptor<PassOnOpen> written = ArgumentCaptor.forClass(PassOnOpen.class);
        verify(opens).save(written.capture());
        assertThat(written.getValue().getKind()).isEqualTo(PassOnOpenKind.KEYHOLDER_ENDED);
        assertThat(written.getValue().getNote()).contains("Sarah").contains("family list");
    }

    @Test
    void endingAFamilyLinkWithNobodyHoldingAKeyChangesNothing() {
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.empty());

        service.onFamilyLinkEnded(margaret.getId(), sarah.getId());

        verify(keyholders, never()).save(any());
        verifyNoInteractions(opens);
    }

    @Test
    void endingAFamilyLinkWithSomebodyWhoAlreadySaidNoChangesNothing() {
        Keyholder said = row(sarah, KeyholderStatus.DECLINED);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(said));

        service.onFamilyLinkEnded(margaret.getId(), sarah.getId());

        assertThat(said.getStatus()).isEqualTo(KeyholderStatus.DECLINED);
        verify(keyholders, never()).save(any());
    }

    // ── counting, re-derived on every single read ──

    @Test
    void countingSkipsAKeyholderWhoseFamilyLinkEndedWithoutTheRowBeingRewritten() {
        // The row still says ACTIVE — nothing has run to change it. The family link is gone,
        // and that alone must stop her counting toward the number who have to agree.
        when(keyholders.findByOwnerIdAndStatus(margaret.getId(), KeyholderStatus.ACTIVE))
                .thenReturn(List.of(row(sarah, KeyholderStatus.ACTIVE), row(david, KeyholderStatus.ACTIVE)));
        when(familyLinks.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(link(margaret, david, FamilyLinkStatus.ACTIVE)));

        assertThat(service.activeCount(margaret.getId())).isEqualTo(1);
    }

    @Test
    void countingAsksTheDatabaseForActiveOnlyAndNeverAStoredTotal() {
        when(keyholders.findByOwnerIdAndStatus(margaret.getId(), KeyholderStatus.ACTIVE))
                .thenReturn(List.of(row(sarah, KeyholderStatus.ACTIVE)));
        when(familyLinks.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(link(margaret, sarah, FamilyLinkStatus.ACTIVE)));

        assertThat(service.activeCount(margaret.getId())).isEqualTo(1);
        verifyNoInteractions(settings);
    }

    @Test
    void herOwnListMarksWhoActuallyCountsRightNow() {
        Keyholder live = row(sarah, KeyholderStatus.ACTIVE);
        Keyholder stale = row(david, KeyholderStatus.ACTIVE);
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(live, stale));
        when(familyLinks.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(link(margaret, sarah, FamilyLinkStatus.ACTIVE)));

        List<KeyholderResponse> list = service.mine(margaret.getId());

        assertThat(list).extracting(KeyholderResponse::countsToward).containsExactly(true, false);
    }

    // ── Step 4: the asymmetry ──

    @Test
    void askingSomebodyNewTellsEveryActiveFamilyMember() {
        onFamilyList(sarah);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.empty());
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of());

        service.invite(margaret.getId(), sarah.getId());

        verify(alerts).keyholderAsked(margaret, "Sarah");
    }

    @Test
    void askingSomebodyNewRestartsTheSevenDays() {
        onFamilyList(sarah);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.empty());
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of());
        PassOnSettings armed = PassOnSettings.builder()
                .ownerId(margaret.getId())
                .approvalsNeeded((short) 2)
                .keyholderTarget((short) 3)
                .armedAt(LocalDateTime.now(clock).minusDays(20))
                .coolingOffUntil(LocalDateTime.now(clock).minusDays(13))
                .build();
        when(settings.findById(margaret.getId())).thenReturn(Optional.of(armed));

        service.invite(margaret.getId(), sarah.getId());

        assertThat(armed.getCoolingOffUntil()).isEqualTo(LocalDateTime.now(clock).plusDays(7));
        verify(settings).save(armed);
    }

    @Test
    void takingAKeyBackTellsNobody() {
        // Deliberate, and not an oversight: an elder who has worked out that a relative is
        // leaning on her must be able to take that person's key away without the app
        // telling them she did it.
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByIdAndOwnerId(holding.getId(), margaret.getId()))
                .thenReturn(Optional.of(holding));

        service.remove(margaret.getId(), holding.getId());

        verifyNoInteractions(alerts);
    }

    @Test
    void takingAKeyBackDoesNotRestartTheSevenDays() {
        // Quiet AND immediate. A restarted cooling-off week would leave her key in place for
        // another seven days, which is the opposite of what she just asked for.
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByIdAndOwnerId(holding.getId(), margaret.getId()))
                .thenReturn(Optional.of(holding));

        service.remove(margaret.getId(), holding.getId());

        verifyNoInteractions(settings);
    }

    @Test
    void aBoxThatWasNeverSetUpHasNoSevenDaysToRestart() {
        onFamilyList(sarah);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.empty());
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of());
        when(settings.findById(margaret.getId())).thenReturn(Optional.empty());

        service.invite(margaret.getId(), sarah.getId());

        verify(settings, never()).save(any());
    }

    // ── the acceptance card ──

    @Test
    void theAcceptanceCardCarriesTheRealNumbersAndNotAnExample() {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholders.findByKeyholderIdAndStatus(sarah.getId(), KeyholderStatus.INVITED))
                .thenReturn(List.of(asked));
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(asked, row(david, KeyholderStatus.ACTIVE), row(person("Ruth"), KeyholderStatus.ACTIVE)));
        when(settings.findById(margaret.getId())).thenReturn(Optional.of(PassOnSettings.builder()
                .ownerId(margaret.getId())
                .approvalsNeeded((short) 2)
                .keyholderTarget((short) 3)
                .build()));

        List<KeyholderAskResponse> cards = service.askedOfMe(sarah.getId());

        assertThat(cards).hasSize(1);
        assertThat(cards.get(0).ownerName()).isEqualTo("Margaret");
        assertThat(cards.get(0).approvalsNeeded()).isEqualTo((short) 2);
        assertThat(cards.get(0).keyholderCount()).isEqualTo(3);
    }

    @Test
    void theAcceptanceCardOmitsTheNumbersBeforeTheBoxIsSetUp() {
        // She may be asked before the threshold is chosen. A card that invents "two of three"
        // would be telling somebody a number nobody has picked.
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholders.findByKeyholderIdAndStatus(sarah.getId(), KeyholderStatus.INVITED))
                .thenReturn(List.of(asked));
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of(asked));
        when(settings.findById(margaret.getId())).thenReturn(Optional.empty());

        List<KeyholderAskResponse> cards = service.askedOfMe(sarah.getId());

        assertThat(cards.get(0).approvalsNeeded()).isNull();
        assertThat(cards.get(0).keyholderCount()).isEqualTo(1);
    }

    // ── the whole list at once, at the end of setup ──

    @Test
    void everybodySheChoseIsAskedInTheOrderShePickedThem() {
        onFamilyList(sarah);
        onFamilyList(david);
        when(keyholders.findByOwnerIdAndKeyholderId(any(), any())).thenReturn(Optional.empty());
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of());

        service.inviteAll(margaret.getId(), List.of(sarah.getId(), david.getId()));

        ArgumentCaptor<Keyholder> saved = ArgumentCaptor.forClass(Keyholder.class);
        verify(keyholders, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(k -> k.getKeyholder().getId())
                .containsExactly(sarah.getId(), david.getId());
        // Every one of them is named to the family, one alert each. An alert saying only
        // "someone" would let exactly the relative this is meant to expose stay anonymous.
        verify(alerts).keyholderAsked(margaret, "Sarah");
        verify(alerts).keyholderAsked(margaret, "David");
    }

    @Test
    void runningSetupAgainDoesNotAskTheSamePersonTwice() {
        // She can come back and change the number who must agree. The people she is keeping
        // must not be asked a second time about her death.
        Keyholder alreadyHolding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(alreadyHolding));

        service.inviteAll(margaret.getId(), List.of(sarah.getId()));

        verify(keyholders, never()).save(any());
        verifyNoInteractions(alerts);
    }

    @Test
    void somebodyWhoSaidNoCanBeAskedAgainByRunningSetupAgain() {
        // DECLINED is not a life sentence. She may have talked to them since.
        onFamilyList(sarah);
        Keyholder saidNo = row(sarah, KeyholderStatus.DECLINED);
        when(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(saidNo));
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of(saidNo));

        service.inviteAll(margaret.getId(), List.of(sarah.getId()));

        assertThat(saidNo.getStatus()).isEqualTo(KeyholderStatus.INVITED);
        verify(alerts).keyholderAsked(margaret, "Sarah");
    }

    // ── undoing the whole arrangement ──

    @Test
    void takingEveryKeyBackAtOnceEndsBothTheAskedAndTheHolding() {
        // Undoing the setup has to reach the person who has not answered yet as well as the
        // one who said yes — otherwise the daughter who talked her into it still has a
        // question about her mother's death sitting on her screen.
        Keyholder waiting = row(sarah, KeyholderStatus.INVITED);
        Keyholder holding = row(david, KeyholderStatus.ACTIVE);
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(waiting, holding));

        service.removeAll(margaret.getId());

        assertThat(waiting.getStatus()).isEqualTo(KeyholderStatus.REMOVED);
        assertThat(holding.getStatus()).isEqualTo(KeyholderStatus.REMOVED);
    }

    @Test
    void takingEveryKeyBackAtOnceIsJustAsQuietAsTakingOne() {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(holding));

        service.removeAll(margaret.getId());

        verifyNoInteractions(alerts);
    }

    @Test
    void takingEveryKeyBackLeavesRowsThatWereAlreadyFinishedAlone() {
        // A daughter who resigned in June did not have her key taken off her in August, and
        // the elder's own record must not say she did.
        Keyholder resigned = row(sarah, KeyholderStatus.RESIGNED);
        when(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(resigned));

        service.removeAll(margaret.getId());

        assertThat(resigned.getStatus()).isEqualTo(KeyholderStatus.RESIGNED);
        verify(keyholders, never()).save(any());
    }

    // ── helpers ──

    private void onFamilyList(User familyMember) {
        when(familyLinks.findByElderIdAndFamilyUserId(margaret.getId(), familyMember.getId()))
                .thenReturn(Optional.of(link(margaret, familyMember, FamilyLinkStatus.ACTIVE)));
    }

    private List<PassOnOpenKind> recordedKinds() {
        ArgumentCaptor<PassOnOpen> written = ArgumentCaptor.forClass(PassOnOpen.class);
        verify(opens, org.mockito.Mockito.atLeastOnce()).save(written.capture());
        return written.getAllValues().stream().map(PassOnOpen::getKind).toList();
    }

    private Keyholder row(User who, KeyholderStatus status) {
        return Keyholder.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .keyholder(who)
                .status(status)
                .invitedAt(LocalDateTime.now(clock).minusDays(1))
                .build();
    }

    private FamilyLink link(User elder, User familyUser, FamilyLinkStatus status) {
        return FamilyLink.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .familyUser(familyUser)
                .initiatedBy(elder)
                .status(status)
                .build();
    }

    private static User person(String name) {
        return User.builder()
                .id(UUID.randomUUID())
                .fullName(name)
                .username(name.toLowerCase())
                .build();
    }
}
