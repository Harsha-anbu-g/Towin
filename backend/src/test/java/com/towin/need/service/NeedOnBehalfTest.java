package com.towin.need.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ApplicationStatus;
import com.towin.common.enums.DelegatedPower;
import com.towin.common.enums.NeedCategory;
import com.towin.common.enums.NeedStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.service.FamilyDelegationService;
import com.towin.need.dto.NeedRequest;
import com.towin.need.dto.NeedResponse;
import com.towin.need.entity.Need;
import com.towin.need.entity.NeedApplication;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guardian mode, power 2: Sarah asks for help on her mother's behalf.
 *
 * Margaret stays the person who needs the help — helpers answer her, the job
 * sits with her other requests, and the connection it creates is hers — while
 * Sarah is recorded as the one who arranged it, so nobody is misled about who
 * they are talking to.
 */
@ExtendWith(MockitoExtension.class)
class NeedOnBehalfTest {

    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository applicationRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock S3Service s3Service;
    @Mock TrustScoreService trustScoreService;
    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyDelegationService familyDelegationService;
    NeedService needService;

    private User margaret;   // the parent, who the help is really for
    private User sarah;      // her daughter
    private User helper;

    @BeforeEach
    void setUp() {
        // The service takes Optional<ConnectionEventProducer>, which @InjectMocks
        // cannot populate, so it is built by hand.
        needService = new NeedService(
                needRepository, applicationRepository, userRepository,
                elderProfileRepository, helperProfileRepository, s3Service,
                trustScoreService, connectionRepository, Optional.empty(),
                familyDelegationService);
        margaret = User.builder().id(UUID.randomUUID()).username("margaret").role(UserRole.ELDER).build();
        sarah = User.builder().id(UUID.randomUUID()).username("sarah").role(UserRole.FAMILY).build();
        helper = User.builder().id(UUID.randomUUID()).username("helper").role(UserRole.HELPER).build();
    }

    private NeedRequest asking(String title, UUID forElder) {
        NeedRequest req = new NeedRequest();
        req.setTitle(title);
        req.setCategory(NeedCategory.TRANSPORTATION);
        req.setOnBehalfOfElderId(forElder);
        return req;
    }

    private Need existingNeed(NeedStatus status) {
        return Need.builder()
                .id(UUID.randomUUID())
                .elder(margaret)
                .title("A lift to the doctor")
                .status(status)
                .build();
    }

    private void sarahMayManageRequests(boolean may) {
        when(familyDelegationService.hasPower(
                sarah.getId(), margaret.getId(), DelegatedPower.MANAGE_HELP_REQUESTS))
                .thenReturn(may);
    }

    @Test
    void delegatedFamilyMemberPostsTheRequestAsTheParentAndIsNamedAsTheArranger() {
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(elderProfileRepository.findByUserId(sarah.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Sarah").build()));
        when(elderProfileRepository.findNamesByUserIds(any())).thenReturn(List.of());
        when(needRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NeedResponse response = needService.postNeed(
                sarah.getId(), asking("A lift to the doctor", margaret.getId()));

        ArgumentCaptor<Need> saved = ArgumentCaptor.forClass(Need.class);
        verify(needRepository).save(saved.capture());
        // The request is Margaret's; Sarah is recorded as the one who arranged it.
        assertThat(saved.getValue().getElder().getId()).isEqualTo(margaret.getId());
        assertThat(saved.getValue().getActedBy().getId()).isEqualTo(sarah.getId());
        assertThat(response.getElderId()).isEqualTo(margaret.getId());
        assertThat(response.getActedByName()).isEqualTo("Sarah");
    }

    @Test
    void familyMemberWithoutThePowerCannotPostForTheParent() {
        org.mockito.Mockito.doThrow(new com.towin.common.exception.ForbiddenException(
                        "You don't have permission to do this for them"))
                .when(familyDelegationService).assertDelegated(
                        sarah.getId(), margaret.getId(), DelegatedPower.MANAGE_HELP_REQUESTS);

        assertThatThrownBy(() -> needService.postNeed(
                sarah.getId(), asking("A lift to the doctor", margaret.getId())))
                .isInstanceOf(com.towin.common.exception.ForbiddenException.class);
        verify(needRepository, never()).save(any());
    }

    @Test
    void familyMemberWithoutThePowerCannotCancelTheParentsRequest() {
        Need need = existingNeed(NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        sarahMayManageRequests(false);

        assertThatThrownBy(() -> needService.cancelNeed(sarah.getId(), need.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only the posting elder can cancel");
        verify(needRepository, never()).save(any());
    }

    @Test
    void theParentsOwnRequestsCarryNoArrangerLabel() {
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(elderProfileRepository.findNamesByUserIds(any())).thenReturn(List.of());
        when(needRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // No onBehalfOfElderId at all: Margaret posting for herself, exactly as before.
        NeedResponse response = needService.postNeed(margaret.getId(), asking("A lift", null));

        ArgumentCaptor<Need> saved = ArgumentCaptor.forClass(Need.class);
        verify(needRepository).save(saved.capture());
        assertThat(saved.getValue().getActedBy()).isNull();
        assertThat(response.getActedByName()).isNull();
        // Someone acting for themselves needs no permission lookup at all.
        verify(familyDelegationService, never()).assertDelegated(any(), any(), any());
    }

    @Test
    void theParentCancellingTheirOwnRequestNeedsNoPermissionCheck() {
        Need need = existingNeed(NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(needRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        needService.cancelNeed(margaret.getId(), need.getId());

        assertThat(need.getStatus()).isEqualTo(NeedStatus.CANCELLED);
        assertThat(need.getActedBy()).isNull();
        verify(familyDelegationService, never()).hasPower(any(), any(), any());
    }

    @Test
    void thePowerIsRecheckedOnEveryActionSoRevokingItStopsTheNextOne() {
        Need need = existingNeed(NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(familyDelegationService.hasPower(
                sarah.getId(), margaret.getId(), DelegatedPower.MANAGE_HELP_REQUESTS))
                .thenReturn(true)      // granted when she cancels
                .thenReturn(false);    // Margaret takes it back straight after
        when(needRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        needService.cancelNeed(sarah.getId(), need.getId());
        assertThat(need.getStatus()).isEqualTo(NeedStatus.CANCELLED);

        need.setStatus(NeedStatus.OPEN);
        assertThatThrownBy(() -> needService.cancelNeed(sarah.getId(), need.getId()))
                .isInstanceOf(IllegalArgumentException.class);
        verify(needRepository).save(any());  // only the first one landed
    }

    @Test
    void acceptingAHelperConnectsThemToTheParentAndNotToTheFamilyMember() {
        // The whole point of the feature: Sarah arranges it, Margaret is the one who
        // actually meets the helper. If the connection were built from Sarah's id she
        // would quietly take her mother's place in the relationship.
        Need need = existingNeed(NeedStatus.OPEN);
        NeedApplication application = NeedApplication.builder()
                .need(need).helper(helper).status(ApplicationStatus.PENDING).build();
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        sarahMayManageRequests(true);
        when(applicationRepository.findByNeedIdAndHelperId(need.getId(), helper.getId()))
                .thenReturn(Optional.of(application));
        when(applicationRepository.findByNeedId(need.getId())).thenReturn(List.of(application));
        when(connectionRepository.findBetweenUsers(margaret.getId(), helper.getId()))
                .thenReturn(Optional.empty());
        when(connectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(elderProfileRepository.findNamesByUserIds(any())).thenReturn(List.of());
        when(needRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        needService.acceptHelper(sarah.getId(), need.getId(), helper.getId());

        ArgumentCaptor<Connection> connection = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(connection.capture());
        assertThat(connection.getValue().getUserA().getId()).isEqualTo(margaret.getId());
        assertThat(connection.getValue().getUserB().getId()).isEqualTo(helper.getId());
        // Margaret wrote this request herself, and Sarah picking the helper does not
        // change that. "Written by" says who wrote it, and nothing else may rewrite it.
        assertThat(need.getActedBy()).isNull();
    }

    @Test
    void aRequestTheParentWroteHerselfIsNeverRelabelledWhenTheFamilyMemberFinishesIt() {
        // The label reads "asked by Sarah" on a helper's screen, so it has to stay
        // true. If completing a job could stamp it, every request Margaret wrote
        // herself would quietly start claiming Sarah wrote it.
        Need need = existingNeed(NeedStatus.ASSIGNED);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        sarahMayManageRequests(true);
        when(applicationRepository.findByNeedId(need.getId())).thenReturn(List.of());
        when(elderProfileRepository.findNamesByUserIds(any())).thenReturn(List.of());
        when(needRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        NeedResponse response = needService.complete(sarah.getId(), need.getId());

        assertThat(need.getStatus()).isEqualTo(NeedStatus.COMPLETED);
        assertThat(need.getActedBy()).isNull();
        assertThat(response.getActedByName()).isNull();
    }

    @Test
    void theFamilyMemberCannotPickHerselfAsTheParentsHelper() {
        // The whole self-dealing route in one test: Sarah writes a request for her
        // mother, offers to help with it, and then hands it to herself — inventing a
        // finished job, a connection to her own parent and the trust that comes with
        // it, with nobody else ever involved. Choosing who comes to help is the
        // parent's own decision, so this stops at the choosing.
        Need need = existingNeed(NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        sarahMayManageRequests(true);

        assertThatThrownBy(() -> needService.acceptHelper(sarah.getId(), need.getId(), sarah.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("can't pick yourself");
        verify(connectionRepository, never()).save(any());
        verify(needRepository, never()).save(any());
    }

    @Test
    void theFamilyMemberWhoLooksAfterTheRequestsCannotOfferToHelpWithOne() {
        // She is on the deciding side of her mother's requests, so she must not also
        // stand on the answering side — that is what makes the pair of them one
        // person wearing two hats.
        Need need = existingNeed(NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        sarahMayManageRequests(true);

        assertThatThrownBy(() -> needService.apply(sarah.getId(), need.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("can't also answer it yourself");
        verify(applicationRepository, never()).save(any());
    }

    @Test
    void anOrdinaryHelperOffersToHelpExactlyAsBefore() {
        // The new guard must not touch the normal case: a helper holds no powers at
        // all, so nothing about offering to help changes for them.
        Need need = existingNeed(NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(familyDelegationService.hasPower(
                helper.getId(), margaret.getId(), DelegatedPower.MANAGE_HELP_REQUESTS))
                .thenReturn(false);
        when(applicationRepository.existsByNeedIdAndHelperId(need.getId(), helper.getId()))
                .thenReturn(false);
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));

        needService.apply(helper.getId(), need.getId(), null);

        ArgumentCaptor<NeedApplication> saved = ArgumentCaptor.forClass(NeedApplication.class);
        verify(applicationRepository).save(saved.capture());
        assertThat(saved.getValue().getHelper().getId()).isEqualTo(helper.getId());
    }

    @Test
    void managingRequestsDoesNotLetTheFamilyMemberActOnADifferentParent() {
        // Sarah helps Margaret. Another elder's request is none of her business, and
        // the grant is looked up against THAT need's owner, never a name she supplies.
        User otherElder = User.builder().id(UUID.randomUUID()).username("arthur").build();
        Need someoneElsesNeed = Need.builder()
                .id(UUID.randomUUID()).elder(otherElder).status(NeedStatus.OPEN).build();
        when(needRepository.findById(someoneElsesNeed.getId())).thenReturn(Optional.of(someoneElsesNeed));
        when(familyDelegationService.hasPower(
                sarah.getId(), otherElder.getId(), DelegatedPower.MANAGE_HELP_REQUESTS))
                .thenReturn(false);

        assertThatThrownBy(() -> needService.cancelNeed(sarah.getId(), someoneElsesNeed.getId()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void managingRequestsIsNotAskedAboutAnyOtherPower() {
        // Holding MANAGE_HELP_REQUESTS must not quietly widen into advancing trust or
        // leaving reviews. Those live in their own services behind their own power,
        // and nothing here ever asks about them.
        Need need = existingNeed(NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        sarahMayManageRequests(true);
        when(needRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        needService.cancelNeed(sarah.getId(), need.getId());

        verify(familyDelegationService, never())
                .hasPower(any(), any(), org.mockito.ArgumentMatchers.eq(DelegatedPower.ADVANCE_TRUST));
        verify(familyDelegationService, never())
                .hasPower(any(), any(), org.mockito.ArgumentMatchers.eq(DelegatedPower.LEAVE_REVIEWS));
    }
}
