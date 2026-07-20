package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.family.dto.FamilyLinkResponse;
import com.towin.family.dto.FamilyLinksResponse;
import com.towin.family.dto.FamilyRequest;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** US-004: create family requests (both directions) and list links/requests. */
@ExtendWith(MockitoExtension.class)
class FamilyServiceTest {

    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock com.towin.family.repository.FamilyAlertRepository familyAlertRepository;
    @Mock UserRepository userRepository;
    @Mock com.towin.common.service.TrustScoreService trustScoreService;
    @Mock com.towin.profile.repository.ElderProfileRepository elderProfileRepository;
    @Mock com.towin.profile.repository.HelperProfileRepository helperProfileRepository;

    FamilyService familyService;

    private User elder;
    private User daughter;

    @BeforeEach
    void setUp() {
        familyService = new FamilyService(
                familyLinkRepository, familyAlertRepository, userRepository, trustScoreService,
                elderProfileRepository, helperProfileRepository);
        elder = buildUser("margaret_elder", UserRole.ELDER);
        daughter = buildUser("sarah_daughter", UserRole.FAMILY);
    }

    private User buildUser(String username, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .email(username + "@test.com")
                .role(role)
                .build();
    }

    private FamilyRequest request(String identifier, String side) {
        FamilyRequest req = new FamilyRequest();
        req.setIdentifier(identifier);
        req.setRelationship("Daughter");
        req.setSide(side);
        return req;
    }

    private void stubHappyPath(User caller, User target) {
        when(userRepository.findById(caller.getId())).thenReturn(Optional.of(caller));
        when(userRepository.findByUsername(target.getUsername())).thenReturn(Optional.of(target));
        when(familyLinkRepository.save(any(FamilyLink.class))).thenAnswer(i -> i.getArgument(0));
    }

    // --- create: side = "family" (caller is the elder adding a family member) ---

    @Test
    void elderCanAddFamilyMember_createsPendingLinkInitiatedByElder() {
        stubHappyPath(elder, daughter);

        FamilyLinkResponse response =
                familyService.createRequest(elder.getId(), request("sarah_daughter", "family"));

        ArgumentCaptor<FamilyLink> captor = ArgumentCaptor.forClass(FamilyLink.class);
        verify(familyLinkRepository).save(captor.capture());
        FamilyLink saved = captor.getValue();
        assertThat(saved.getElder().getId()).isEqualTo(elder.getId());
        assertThat(saved.getFamilyUser().getId()).isEqualTo(daughter.getId());
        assertThat(saved.getInitiatedBy().getId()).isEqualTo(elder.getId());
        assertThat(saved.getStatus()).isEqualTo(FamilyLinkStatus.PENDING);
        assertThat(saved.getRelationship()).isEqualTo("Daughter");
        assertThat(response.getStatus()).isEqualTo(FamilyLinkStatus.PENDING);
        assertThat(response.isInitiatedByMe()).isTrue();
    }

    @Test
    void helperCannotTakeTheElderSeat() {
        User helper = buildUser("harry_helper", UserRole.HELPER);
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));

        assertThatThrownBy(() -> familyService.createRequest(helper.getId(), request("sarah_daughter", "family")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only elders can add family members");
        verify(familyLinkRepository, never()).save(any());
    }

    // --- create: side = "elder" (caller is the family member adding their parent) ---

    @Test
    void familyMemberCanAddTheirParent() {
        stubHappyPath(daughter, elder);

        familyService.createRequest(daughter.getId(), request("margaret_elder", "elder"));

        ArgumentCaptor<FamilyLink> captor = ArgumentCaptor.forClass(FamilyLink.class);
        verify(familyLinkRepository).save(captor.capture());
        FamilyLink saved = captor.getValue();
        assertThat(saved.getElder().getId()).isEqualTo(elder.getId());
        assertThat(saved.getFamilyUser().getId()).isEqualTo(daughter.getId());
        assertThat(saved.getInitiatedBy().getId()).isEqualTo(daughter.getId());
    }

    @Test
    void targetOfSideElderMustBeAnElder_rejectedWithGenericMessage() {
        // A HELPER cannot take the elder seat; the message stays generic so
        // identifiers cannot be probed for account existence/role.
        User helper = buildUser("harry_helper", UserRole.HELPER);
        when(userRepository.findById(daughter.getId())).thenReturn(Optional.of(daughter));
        when(userRepository.findByUsername("harry_helper")).thenReturn(Optional.of(helper));

        assertThatThrownBy(() -> familyService.createRequest(daughter.getId(), request("harry_helper", "elder")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("We couldn't find that person");
        verify(familyLinkRepository, never()).save(any());
    }

    // --- identifier resolution (reuses the login lookup semantics) ---

    @Test
    void unknownIdentifierRejectedWithGenericMessage() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> familyService.createRequest(elder.getId(), request("nobody", "family")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("We couldn't find that person");
    }

    @Test
    void identifierWithAtSignResolvesByEmail() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(userRepository.findByEmail("sarah_daughter@test.com")).thenReturn(Optional.of(daughter));
        when(familyLinkRepository.save(any(FamilyLink.class))).thenAnswer(i -> i.getArgument(0));

        familyService.createRequest(elder.getId(), request("sarah_daughter@test.com", "family"));

        verify(userRepository).findByEmail("sarah_daughter@test.com");
        verify(familyLinkRepository).save(any(FamilyLink.class));
    }

    @Test
    void phoneIdentifierIsNormalizedBeforeLookup() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(userRepository.findByPhone("+15551234567")).thenReturn(Optional.of(daughter));
        when(familyLinkRepository.save(any(FamilyLink.class))).thenAnswer(i -> i.getArgument(0));

        familyService.createRequest(elder.getId(), request("+1 (555) 123-4567", "family"));

        verify(userRepository).findByPhone("+15551234567");
    }

    // --- guards ---

    @Test
    void cannotAddYourself() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(userRepository.findByUsername("margaret_elder")).thenReturn(Optional.of(elder));

        assertThatThrownBy(() -> familyService.createRequest(elder.getId(), request("margaret_elder", "family")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("yourself");
    }

    @Test
    void duplicatePendingOrActivePairRejected() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(userRepository.findByUsername("sarah_daughter")).thenReturn(Optional.of(daughter));
        FamilyLink existing = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(daughter)
                .initiatedBy(elder).status(FamilyLinkStatus.ACTIVE).build();
        when(familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), daughter.getId()))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> familyService.createRequest(elder.getId(), request("sarah_daughter", "family")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void revokedPairCanBeRequestedAgain_reusesTheRow() {
        // UNIQUE(elder_id, family_user_id) means a second row is impossible —
        // re-requesting resets the existing terminal row back to PENDING.
        when(userRepository.findById(daughter.getId())).thenReturn(Optional.of(daughter));
        when(userRepository.findByUsername("margaret_elder")).thenReturn(Optional.of(elder));
        FamilyLink revoked = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(daughter)
                .initiatedBy(elder).status(FamilyLinkStatus.REVOKED)
                .isPrimary(false)
                .respondedAt(LocalDateTime.now().minusDays(2))
                .revokedAt(LocalDateTime.now().minusDays(1))
                .build();
        when(familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), daughter.getId()))
                .thenReturn(Optional.of(revoked));
        when(familyLinkRepository.save(any(FamilyLink.class))).thenAnswer(i -> i.getArgument(0));

        familyService.createRequest(daughter.getId(), request("margaret_elder", "elder"));

        ArgumentCaptor<FamilyLink> captor = ArgumentCaptor.forClass(FamilyLink.class);
        verify(familyLinkRepository).save(captor.capture());
        FamilyLink saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(revoked.getId());
        assertThat(saved.getStatus()).isEqualTo(FamilyLinkStatus.PENDING);
        assertThat(saved.getInitiatedBy().getId()).isEqualTo(daughter.getId());
        assertThat(saved.getRespondedAt()).isNull();
        assertThat(saved.getRevokedAt()).isNull();
    }

    @Test
    void elderCapAtFiveCountsPendingPlusActive() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(userRepository.findByUsername("sarah_daughter")).thenReturn(Optional.of(daughter));
        when(familyLinkRepository.countByElderIdAndStatusIn(eq(elder.getId()), anyCollection()))
                .thenReturn(5L);

        assertThatThrownBy(() -> familyService.createRequest(elder.getId(), request("sarah_daughter", "family")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Family limit reached");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<FamilyLinkStatus>> statuses = ArgumentCaptor.forClass(Collection.class);
        verify(familyLinkRepository).countByElderIdAndStatusIn(eq(elder.getId()), statuses.capture());
        assertThat(statuses.getValue())
                .containsExactlyInAnyOrder(FamilyLinkStatus.PENDING, FamilyLinkStatus.ACTIVE);
    }

    @Test
    void rateLimitTenRequestsPerDayPerUser() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(userRepository.findByUsername("sarah_daughter")).thenReturn(Optional.of(daughter));
        when(familyLinkRepository.countByInitiatedByIdAndCreatedAtAfter(eq(elder.getId()), any(LocalDateTime.class)))
                .thenReturn(10L);

        assertThatThrownBy(() -> familyService.createRequest(elder.getId(), request("sarah_daughter", "family")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Daily family request limit reached");
        verify(familyLinkRepository, never()).save(any());
    }

    @Test
    void invalidSideRejected() {
        assertThatThrownBy(() -> familyService.createRequest(elder.getId(), request("sarah_daughter", "sideways")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(familyLinkRepository, never()).save(any());
    }

    // --- GET /api/family/links ---

    @Test
    void getLinks_elderPerspective_splitsActiveIncomingOutgoing() {
        User son = buildUser("sam_son", UserRole.FAMILY);
        FamilyLink active = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(daughter)
                .initiatedBy(elder).status(FamilyLinkStatus.ACTIVE).isPrimary(true).build();
        FamilyLink incoming = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(son)
                .initiatedBy(son).status(FamilyLinkStatus.PENDING).isPrimary(false).build();
        when(familyLinkRepository.findByElderIdAndStatus(elder.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(active));
        when(familyLinkRepository.findByFamilyUserIdAndStatus(elder.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of());
        when(familyLinkRepository.findByParticipantAndStatus(elder.getId(), FamilyLinkStatus.PENDING))
                .thenReturn(List.of(incoming));

        FamilyLinksResponse response = familyService.getLinks(elder.getId());

        assertThat(response.getActiveLinks()).hasSize(1);
        assertThat(response.getActiveLinks().get(0).getOtherUserName()).isEqualTo("sarah_daughter");
        assertThat(response.getActiveLinks().get(0).isIAmElder()).isTrue();
        assertThat(response.getActiveLinks().get(0).getIsPrimary()).isTrue();
        assertThat(response.getIncomingRequests()).hasSize(1);
        assertThat(response.getIncomingRequests().get(0).getOtherUserName()).isEqualTo("sam_son");
        assertThat(response.getIncomingRequests().get(0).isInitiatedByMe()).isFalse();
        assertThat(response.getOutgoingRequests()).isEmpty();
    }

    @Test
    void getLinks_familyPerspective_splitsActiveIncomingOutgoing() {
        FamilyLink active = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(daughter)
                .initiatedBy(elder).status(FamilyLinkStatus.ACTIVE).isPrimary(false).build();
        User dad = buildUser("dan_dad", UserRole.BOTH);
        FamilyLink outgoing = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(dad).familyUser(daughter)
                .initiatedBy(daughter).status(FamilyLinkStatus.PENDING).isPrimary(false).build();
        when(familyLinkRepository.findByElderIdAndStatus(daughter.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of());
        when(familyLinkRepository.findByFamilyUserIdAndStatus(daughter.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(active));
        when(familyLinkRepository.findByParticipantAndStatus(daughter.getId(), FamilyLinkStatus.PENDING))
                .thenReturn(List.of(outgoing));

        FamilyLinksResponse response = familyService.getLinks(daughter.getId());

        assertThat(response.getActiveLinks()).hasSize(1);
        assertThat(response.getActiveLinks().get(0).getOtherUserName()).isEqualTo("margaret_elder");
        assertThat(response.getActiveLinks().get(0).isIAmElder()).isFalse();
        assertThat(response.getOutgoingRequests()).hasSize(1);
        assertThat(response.getOutgoingRequests().get(0).getOtherUserName()).isEqualTo("dan_dad");
        assertThat(response.getOutgoingRequests().get(0).isInitiatedByMe()).isTrue();
        assertThat(response.getIncomingRequests()).isEmpty();
    }
}
