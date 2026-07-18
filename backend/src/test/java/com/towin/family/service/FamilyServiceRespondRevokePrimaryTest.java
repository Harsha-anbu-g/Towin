package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.family.dto.FamilyLinkResponse;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** US-005: respond to family requests, revoke links, move the primary flag. */
@ExtendWith(MockitoExtension.class)
class FamilyServiceRespondRevokePrimaryTest {

    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock UserRepository userRepository;

    FamilyService familyService;

    private User elder;
    private User daughter;
    private User stranger;

    @BeforeEach
    void setUp() {
        familyService = new FamilyService(familyLinkRepository, userRepository);
        elder = buildUser("margaret_elder", UserRole.ELDER);
        daughter = buildUser("sarah_daughter", UserRole.FAMILY);
        stranger = buildUser("steve_stranger", UserRole.HELPER);
    }

    private User buildUser(String username, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .email(username + "@test.com")
                .role(role)
                .build();
    }

    private FamilyLink link(User initiatedBy, FamilyLinkStatus status, boolean primary) {
        return FamilyLink.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .familyUser(daughter)
                .initiatedBy(initiatedBy)
                .relationship("Daughter")
                .status(status)
                .isPrimary(primary)
                .build();
    }

    private void stubFind(FamilyLink l) {
        when(familyLinkRepository.findById(l.getId())).thenReturn(Optional.of(l));
    }

    private void stubSave() {
        when(familyLinkRepository.save(any(FamilyLink.class))).thenAnswer(i -> i.getArgument(0));
    }

    // --- POST /api/family/requests/{id}/respond ---

    @Test
    void receiverAcceptsPendingRequest_setsActiveAndRespondedAt() {
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING, false);
        stubFind(pending);
        stubSave();

        FamilyLinkResponse response = familyService.respond(daughter.getId(), pending.getId(), true);

        assertThat(pending.getStatus()).isEqualTo(FamilyLinkStatus.ACTIVE);
        assertThat(pending.getRespondedAt()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(FamilyLinkStatus.ACTIVE);
        verify(familyLinkRepository).save(pending);
    }

    @Test
    void receiverDeclinesPendingRequest_setsDeclinedAndRespondedAt() {
        FamilyLink pending = link(daughter, FamilyLinkStatus.PENDING, false);
        stubFind(pending);
        stubSave();

        FamilyLinkResponse response = familyService.respond(elder.getId(), pending.getId(), false);

        assertThat(pending.getStatus()).isEqualTo(FamilyLinkStatus.DECLINED);
        assertThat(pending.getRespondedAt()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(FamilyLinkStatus.DECLINED);
    }

    @Test
    void initiatorCannotRespondToOwnRequest() {
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING, false);
        stubFind(pending);

        assertThatThrownBy(() -> familyService.respond(elder.getId(), pending.getId(), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("You can't respond to your own family request");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void nonParticipantCannotRespond() {
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING, false);
        stubFind(pending);

        assertThatThrownBy(() -> familyService.respond(stranger.getId(), pending.getId(), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("You are not part of this family link");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void respondOnNonPendingLinkRejected() {
        FamilyLink active = link(elder, FamilyLinkStatus.ACTIVE, false);
        stubFind(active);

        assertThatThrownBy(() -> familyService.respond(daughter.getId(), active.getId(), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("This family request is no longer pending");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void respondOnUnknownLinkIsNotFound() {
        UUID unknown = UUID.randomUUID();
        when(familyLinkRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> familyService.respond(daughter.getId(), unknown, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    // --- DELETE /api/family/links/{id} (revoke-rights matrix) ---

    @Test
    void elderRevokesActiveLink_setsRevokedAndClearsPrimary() {
        FamilyLink active = link(elder, FamilyLinkStatus.ACTIVE, true);
        stubFind(active);
        stubSave();

        familyService.revoke(elder.getId(), active.getId());

        assertThat(active.getStatus()).isEqualTo(FamilyLinkStatus.REVOKED);
        assertThat(active.getRevokedAt()).isNotNull();
        assertThat(active.getIsPrimary()).isFalse();
        verify(familyLinkRepository).save(active);
    }

    @Test
    void familyMemberMayUnlinkThemselfFromActiveLink() {
        FamilyLink active = link(elder, FamilyLinkStatus.ACTIVE, false);
        stubFind(active);
        stubSave();

        familyService.revoke(daughter.getId(), active.getId());

        assertThat(active.getStatus()).isEqualTo(FamilyLinkStatus.REVOKED);
        assertThat(active.getRevokedAt()).isNotNull();
    }

    @Test
    void initiatorMayCancelOwnPendingRequest() {
        FamilyLink pending = link(daughter, FamilyLinkStatus.PENDING, false);
        stubFind(pending);
        stubSave();

        familyService.revoke(daughter.getId(), pending.getId());

        assertThat(pending.getStatus()).isEqualTo(FamilyLinkStatus.REVOKED);
        assertThat(pending.getRevokedAt()).isNotNull();
    }

    @Test
    void elderMayRevokePendingRequestInitiatedByFamily() {
        // "elder revokes any link" — including a request they received.
        FamilyLink pending = link(daughter, FamilyLinkStatus.PENDING, false);
        stubFind(pending);
        stubSave();

        familyService.revoke(elder.getId(), pending.getId());

        assertThat(pending.getStatus()).isEqualTo(FamilyLinkStatus.REVOKED);
    }

    @Test
    void familyMemberCannotCancelElderInitiatedPendingRequest() {
        // The receiving family member declines via respond; only the sender cancels.
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING, false);
        stubFind(pending);

        assertThatThrownBy(() -> familyService.revoke(daughter.getId(), pending.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only the person who sent this request can cancel it");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void nonParticipantCannotRevoke() {
        FamilyLink active = link(elder, FamilyLinkStatus.ACTIVE, false);
        stubFind(active);

        assertThatThrownBy(() -> familyService.revoke(stranger.getId(), active.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("You are not part of this family link");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void alreadyEndedLinkCannotBeRevoked() {
        FamilyLink revoked = link(elder, FamilyLinkStatus.REVOKED, false);
        stubFind(revoked);

        assertThatThrownBy(() -> familyService.revoke(elder.getId(), revoked.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("This family link has already ended");
        verify(familyLinkRepository, never()).save(any());
    }

    // --- POST /api/family/links/{id}/primary ---

    @Test
    void elderMovesPrimaryFlagBetweenActiveLinks() {
        User son = buildUser("sam_son", UserRole.FAMILY);
        FamilyLink currentPrimary = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(son)
                .initiatedBy(elder).status(FamilyLinkStatus.ACTIVE).isPrimary(true).build();
        FamilyLink target = link(elder, FamilyLinkStatus.ACTIVE, false);
        stubFind(target);
        when(familyLinkRepository.findByElderIdAndStatus(elder.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(currentPrimary, target));
        when(familyLinkRepository.saveAndFlush(any(FamilyLink.class))).thenAnswer(i -> i.getArgument(0));
        stubSave();

        FamilyLinkResponse response = familyService.setPrimary(elder.getId(), target.getId());

        assertThat(currentPrimary.getIsPrimary()).isFalse();
        assertThat(target.getIsPrimary()).isTrue();
        assertThat(response.getIsPrimary()).isTrue();
        // Old primary is flushed BEFORE the new one is saved, so the partial
        // unique index (one ACTIVE primary per elder) is never violated mid-flush.
        var order = inOrder(familyLinkRepository);
        order.verify(familyLinkRepository).saveAndFlush(currentPrimary);
        order.verify(familyLinkRepository).save(target);
    }

    @Test
    void elderMakesFirstPrimary_whenNoneExists() {
        FamilyLink target = link(elder, FamilyLinkStatus.ACTIVE, false);
        stubFind(target);
        when(familyLinkRepository.findByElderIdAndStatus(elder.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(target));
        stubSave();

        FamilyLinkResponse response = familyService.setPrimary(elder.getId(), target.getId());

        assertThat(response.getIsPrimary()).isTrue();
        verify(familyLinkRepository, never()).saveAndFlush(any());
    }

    @Test
    void familyMemberCannotSetPrimary() {
        FamilyLink active = link(elder, FamilyLinkStatus.ACTIVE, false);
        stubFind(active);

        assertThatThrownBy(() -> familyService.setPrimary(daughter.getId(), active.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only the elder can choose the main contact");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void pendingLinkCannotBePrimary() {
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING, false);
        stubFind(pending);

        assertThatThrownBy(() -> familyService.setPrimary(elder.getId(), pending.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only an accepted family member can be the main contact");
        verify(familyLinkRepository, never()).save(any());
    }
}
