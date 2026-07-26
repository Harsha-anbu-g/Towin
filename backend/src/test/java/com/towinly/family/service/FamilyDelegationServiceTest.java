package com.towinly.family.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.DelegatedPower;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.exception.ForbiddenException;
import com.towinly.connection.entity.Connection;
import com.towinly.common.enums.PowerRequestStatus;
import com.towinly.family.entity.FamilyDelegatedPower;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.entity.FamilyPowerRequest;
import com.towinly.family.repository.FamilyDelegatedPowerRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.family.repository.FamilyPowerRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guardian delegation gate (user decisions 2026-07-19): only the elder grants,
 * grant/revoke reconcile in one call, and every action re-checks the grant.
 */
@ExtendWith(MockitoExtension.class)
class FamilyDelegationServiceTest {

    @Mock FamilyDelegatedPowerRepository powerRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyPowerRequestRepository requestRepository;
    @InjectMocks FamilyDelegationService service;

    private User margaret, sarah, helper;
    private FamilyLink link;

    @BeforeEach
    void setUp() {
        margaret = User.builder().id(UUID.randomUUID()).build();
        sarah = User.builder().id(UUID.randomUUID()).build();
        helper = User.builder().id(UUID.randomUUID()).build();
        link = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(margaret).familyUser(sarah)
                .initiatedBy(sarah).status(FamilyLinkStatus.ACTIVE).build();
    }

    @Test
    void elderGrantsAndRevokesPowersInOneReconcile() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        // Currently holds LEAVE_REVIEWS; elder wants MANAGE_HELP_REQUESTS + ADVANCE_TRUST.
        when(powerRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(List.of(FamilyDelegatedPower.builder().power(DelegatedPower.LEAVE_REVIEWS).build()));

        service.setPowers(margaret.getId(), link.getId(),
                EnumSet.of(DelegatedPower.MANAGE_HELP_REQUESTS, DelegatedPower.ADVANCE_TRUST));

        verify(powerRepository).deleteByElderIdAndFamilyUserIdAndPower(margaret.getId(), sarah.getId(), DelegatedPower.LEAVE_REVIEWS);
        verify(powerRepository, never()).deleteByElderIdAndFamilyUserIdAndPower(eq(margaret.getId()), eq(sarah.getId()), eq(DelegatedPower.MANAGE_HELP_REQUESTS));
        verify(powerRepository, org.mockito.Mockito.times(2)).save(any(FamilyDelegatedPower.class));
    }

    /**
     * One tap off. The client sends `{"powers":[]}`, which deserializes to a plain
     * empty Set — not an EnumSet — so this path must not blow up on EnumSet.copyOf.
     */
    @Test
    void elderRevokesEveryPowerWithAnEmptySet() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        when(powerRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(List.of(
                        FamilyDelegatedPower.builder().power(DelegatedPower.MANAGE_HELP_REQUESTS).build(),
                        FamilyDelegatedPower.builder().power(DelegatedPower.LEAVE_REVIEWS).build()));

        Set<DelegatedPower> remaining = service.setPowers(margaret.getId(), link.getId(), new LinkedHashSet<>());

        assertThat(remaining).isEmpty();
        verify(powerRepository).deleteByElderIdAndFamilyUserIdAndPower(margaret.getId(), sarah.getId(), DelegatedPower.MANAGE_HELP_REQUESTS);
        verify(powerRepository).deleteByElderIdAndFamilyUserIdAndPower(margaret.getId(), sarah.getId(), DelegatedPower.LEAVE_REVIEWS);
        verify(powerRepository, never()).save(any());
    }

    @Test
    void onlyTheElderSeatMayGrant() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));

        // Sarah (the family member) tries to grant herself powers — refused.
        assertThatThrownBy(() -> service.setPowers(sarah.getId(), link.getId(),
                EnumSet.of(DelegatedPower.LEAVE_REVIEWS)))
                .isInstanceOf(ForbiddenException.class);
        verify(powerRepository, never()).save(any());
    }

    @Test
    void hasPowerRequiresBothAnActiveLinkAndTheGrant() {
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));
        when(powerRepository.existsByElderIdAndFamilyUserIdAndPower(margaret.getId(), sarah.getId(), DelegatedPower.ADVANCE_TRUST))
                .thenReturn(true);

        assertThat(service.hasPower(sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST)).isTrue();
    }

    @Test
    void assertDelegatedThrowsWhenTheGrantIsMissing() {
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));
        lenient().when(powerRepository.existsByElderIdAndFamilyUserIdAndPower(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> service.assertDelegated(sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST))
                .isInstanceOf(ForbiddenException.class);
    }

    /**
     * Watching gates doing, not only seeing. Sarah holds ADVANCE_TRUST over
     * Margaret in general, but this particular friendship is one Margaret kept to
     * herself — so the server refuses, and never even asks about the grant.
     */
    @Test
    void aFriendshipTheParentKeptPrivateIsRefusedEvenWithThePower() {
        Connection privateOne = Connection.builder().userA(margaret).userB(helper)
                .sharedWithFamily(false).build();

        assertThat(service.hasPowerOn(sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST, privateOne))
                .isFalse();
        assertThatThrownBy(() -> service.assertDelegatedOn(
                sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST, privateOne))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("shared this friendship");
        verify(powerRepository, never()).existsByElderIdAndFamilyUserIdAndPower(any(), any(), any());
    }

    /** The same friendship, once shared: grant + Watching both hold, so it passes. */
    @Test
    void aSharedFriendshipStillNeedsTheGrantAndPassesWithIt() {
        Connection sharedOne = Connection.builder().userA(margaret).userB(helper)
                .sharedWithFamily(true).build();
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));
        when(powerRepository.existsByElderIdAndFamilyUserIdAndPower(
                margaret.getId(), sarah.getId(), DelegatedPower.ADVANCE_TRUST)).thenReturn(true);

        assertThat(service.hasPowerOn(sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST, sharedOne))
                .isTrue();
    }

    /** A missing connection is not an open door. */
    @Test
    void noConnectionIsRefused() {
        assertThat(service.hasPowerOn(sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST, null))
                .isFalse();
    }

    @Test
    void revokedLinkGrantsNoPower() {
        link.setStatus(FamilyLinkStatus.REVOKED);
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));

        assertThat(service.hasPower(sarah.getId(), margaret.getId(), DelegatedPower.ADVANCE_TRUST)).isFalse();
    }

    // ── Consent flow (2026-07-26): the family member asks, the elder answers ──

    private FamilyPowerRequest pendingAsk(DelegatedPower power) {
        return FamilyPowerRequest.builder()
                .id(UUID.randomUUID()).elder(margaret).familyUser(sarah)
                .power(power).status(PowerRequestStatus.PENDING).build();
    }

    @Test
    void theFamilySideAsksAndAPendingRequestIsSaved() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        when(requestRepository.save(any(FamilyPowerRequest.class))).thenAnswer(i -> i.getArgument(0));

        FamilyPowerRequest saved = service.requestPower(sarah.getId(), link.getId(), DelegatedPower.LEAVE_REVIEWS);

        assertThat(saved.getPower()).isEqualTo(DelegatedPower.LEAVE_REVIEWS);
        assertThat(saved.getElder()).isEqualTo(margaret);
        assertThat(saved.getFamilyUser()).isEqualTo(sarah);
    }

    /** Asking is the family member's move — the elder has switches, not asks. */
    @Test
    void onlyTheFamilySeatMayAsk() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));

        assertThatThrownBy(() -> service.requestPower(margaret.getId(), link.getId(), DelegatedPower.LEAVE_REVIEWS))
                .isInstanceOf(ForbiddenException.class);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void askingOnAnInactiveLinkIsRefused() {
        link.setStatus(FamilyLinkStatus.REVOKED);
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));

        assertThatThrownBy(() -> service.requestPower(sarah.getId(), link.getId(), DelegatedPower.LEAVE_REVIEWS))
                .isInstanceOf(IllegalStateException.class);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void askingForAPowerAlreadyGrantedIsRefused() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        when(powerRepository.existsByElderIdAndFamilyUserIdAndPower(
                margaret.getId(), sarah.getId(), DelegatedPower.ADVANCE_TRUST)).thenReturn(true);

        assertThatThrownBy(() -> service.requestPower(sarah.getId(), link.getId(), DelegatedPower.ADVANCE_TRUST))
                .hasMessageContaining("already let you");
        verify(requestRepository, never()).save(any());
    }

    @Test
    void askingTwiceWhileTheFirstAskWaitsIsRefused() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        when(requestRepository.findByElderIdAndFamilyUserIdAndPowerAndStatus(
                margaret.getId(), sarah.getId(), DelegatedPower.LEAVE_REVIEWS, PowerRequestStatus.PENDING))
                .thenReturn(Optional.of(pendingAsk(DelegatedPower.LEAVE_REVIEWS)));

        assertThatThrownBy(() -> service.requestPower(sarah.getId(), link.getId(), DelegatedPower.LEAVE_REVIEWS))
                .hasMessageContaining("already asked");
        verify(requestRepository, never()).save(any());
    }

    /**
     * The cooldown keys off ANY answered ask — a decline throttles nagging, and
     * approve-then-revoke is throttled the same way, so flipping a switch off
     * doesn't invite an instant re-ask.
     */
    @Test
    void aFreshlyAnsweredAskStartsACooldown() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        FamilyPowerRequest declined = pendingAsk(DelegatedPower.LEAVE_REVIEWS);
        declined.setStatus(PowerRequestStatus.DECLINED);
        declined.setRespondedAt(LocalDateTime.now().minusDays(2));
        when(requestRepository.findTopByElderIdAndFamilyUserIdAndPowerAndStatusInOrderByRespondedAtDesc(
                eq(margaret.getId()), eq(sarah.getId()), eq(DelegatedPower.LEAVE_REVIEWS), any()))
                .thenReturn(Optional.of(declined));

        assertThatThrownBy(() -> service.requestPower(sarah.getId(), link.getId(), DelegatedPower.LEAVE_REVIEWS))
                .hasMessageContaining("recently");
        verify(requestRepository, never()).save(any());
    }

    @Test
    void theCooldownExpiresAndAskingWorksAgain() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        FamilyPowerRequest old = pendingAsk(DelegatedPower.LEAVE_REVIEWS);
        old.setStatus(PowerRequestStatus.DECLINED);
        old.setRespondedAt(LocalDateTime.now().minusDays(8));
        when(requestRepository.findTopByElderIdAndFamilyUserIdAndPowerAndStatusInOrderByRespondedAtDesc(
                eq(margaret.getId()), eq(sarah.getId()), eq(DelegatedPower.LEAVE_REVIEWS), any()))
                .thenReturn(Optional.of(old));
        when(requestRepository.save(any(FamilyPowerRequest.class))).thenAnswer(i -> i.getArgument(0));

        assertThat(service.requestPower(sarah.getId(), link.getId(), DelegatedPower.LEAVE_REVIEWS)).isNotNull();
    }

    @Test
    void onlyTheElderMayAnswerAnAsk() {
        FamilyPowerRequest ask = pendingAsk(DelegatedPower.LEAVE_REVIEWS);
        when(requestRepository.findById(ask.getId())).thenReturn(Optional.of(ask));

        assertThatThrownBy(() -> service.respondToRequest(sarah.getId(), ask.getId(), true))
                .isInstanceOf(ForbiddenException.class);
        verify(powerRepository, never()).save(any());
    }

    @Test
    void approvingWritesTheGrantAndClosesTheAsk() {
        FamilyPowerRequest ask = pendingAsk(DelegatedPower.LEAVE_REVIEWS);
        when(requestRepository.findById(ask.getId())).thenReturn(Optional.of(ask));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));

        service.respondToRequest(margaret.getId(), ask.getId(), true);

        assertThat(ask.getStatus()).isEqualTo(PowerRequestStatus.APPROVED);
        assertThat(ask.getRespondedAt()).isNotNull();
        verify(powerRepository).save(any(FamilyDelegatedPower.class));
    }

    @Test
    void decliningClosesTheAskWithoutGrantingAnything() {
        FamilyPowerRequest ask = pendingAsk(DelegatedPower.LEAVE_REVIEWS);
        when(requestRepository.findById(ask.getId())).thenReturn(Optional.of(ask));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));

        service.respondToRequest(margaret.getId(), ask.getId(), false);

        assertThat(ask.getStatus()).isEqualTo(PowerRequestStatus.DECLINED);
        verify(powerRepository, never()).save(any());
    }

    /** The approve-vs-unlink race: the link is re-checked inside the transaction. */
    @Test
    void anAskFromAPairNoLongerLinkedCannotBeApproved() {
        FamilyPowerRequest ask = pendingAsk(DelegatedPower.LEAVE_REVIEWS);
        link.setStatus(FamilyLinkStatus.REVOKED);
        when(requestRepository.findById(ask.getId())).thenReturn(Optional.of(ask));
        when(familyLinkRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));

        assertThatThrownBy(() -> service.respondToRequest(margaret.getId(), ask.getId(), true))
                .isInstanceOf(IllegalStateException.class);
        verify(powerRepository, never()).save(any());
    }

    /** Flipping the Controls switch on directly answers the open ask too. */
    @Test
    void aDirectGrantAnswersTheOpenAsk() {
        when(familyLinkRepository.findById(link.getId())).thenReturn(Optional.of(link));
        when(powerRepository.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(List.of());
        FamilyPowerRequest ask = pendingAsk(DelegatedPower.LEAVE_REVIEWS);
        when(requestRepository.findByElderIdAndFamilyUserIdAndPowerAndStatus(
                margaret.getId(), sarah.getId(), DelegatedPower.LEAVE_REVIEWS, PowerRequestStatus.PENDING))
                .thenReturn(Optional.of(ask));

        service.setPowers(margaret.getId(), link.getId(), EnumSet.of(DelegatedPower.LEAVE_REVIEWS));

        assertThat(ask.getStatus()).isEqualTo(PowerRequestStatus.APPROVED);
        assertThat(ask.getRespondedAt()).isNotNull();
        verify(requestRepository).save(ask);
    }

    /** Unlinking ends consent — grants and open asks both go. */
    @Test
    void revokeAllClearsGrantsAndOpenAsks() {
        service.revokeAll(margaret.getId(), sarah.getId());

        verify(powerRepository).deleteByElderIdAndFamilyUserId(margaret.getId(), sarah.getId());
        verify(requestRepository).deleteByElderIdAndFamilyUserIdAndStatus(
                margaret.getId(), sarah.getId(), PowerRequestStatus.PENDING);
    }
}
