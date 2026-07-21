package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.DelegatedPower;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.exception.ForbiddenException;
import com.towin.connection.entity.Connection;
import com.towin.family.entity.FamilyDelegatedPower;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyDelegatedPowerRepository;
import com.towin.family.repository.FamilyLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
}
