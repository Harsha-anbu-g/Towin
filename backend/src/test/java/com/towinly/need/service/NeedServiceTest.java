package com.towinly.need.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.*;
import com.towinly.need.dto.NeedRequest;
import com.towinly.need.dto.NeedResponse;
import com.towinly.need.entity.Need;
import com.towinly.need.entity.NeedApplication;
import com.towinly.need.repository.NeedApplicationRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.connection.entity.Connection;
import com.towinly.notification.service.ExpoPushService;
import com.towinly.common.repository.UserRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NeedServiceTest {

    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository applicationRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock com.towinly.profile.repository.HelperProfileRepository helperProfileRepository;
    @Mock com.towinly.common.service.S3Service s3Service;
    @Mock com.towinly.common.service.TrustScoreService trustScoreService;
    @Mock com.towinly.connection.repository.ConnectionRepository connectionRepository;
    @Mock com.towinly.family.service.FamilyDelegationService familyDelegationService;
    @Mock ExpoPushService expoPushService;
    @Mock com.towinly.block.service.BlockService blockService;
    NeedService needService;

    private User elder;
    private User helper;

    @BeforeEach
    void setUp() {
        // Manual construction: the service takes Optional<ConnectionEventProducer>,
        // which @InjectMocks cannot populate
        needService = new NeedService(
                needRepository, applicationRepository, userRepository,
                elderProfileRepository, helperProfileRepository, s3Service,
                trustScoreService, connectionRepository, Optional.empty(),
                familyDelegationService, expoPushService, blockService);
        elder = buildUser(UUID.randomUUID(), UserRole.ELDER);
        elder.setLocationLat(BigDecimal.valueOf(43.65));
        elder.setLocationLng(BigDecimal.valueOf(-79.38));

        helper = buildUser(UUID.randomUUID(), UserRole.HELPER);
        helper.setLocationLat(BigDecimal.valueOf(43.66));
        helper.setLocationLng(BigDecimal.valueOf(-79.39));
    }

    @Test
    void shouldPostNeed() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(needRepository.save(any(Need.class))).thenAnswer(i -> i.getArgument(0));

        NeedRequest request = new NeedRequest();
        request.setTitle("Need a ride to the doctor");
        request.setCategory(NeedCategory.TRANSPORTATION);

        NeedResponse response = needService.postNeed(elder.getId(), request);

        assertThat(response.getTitle()).isEqualTo("Need a ride to the doctor");
        assertThat(response.getCategory()).isEqualTo(NeedCategory.TRANSPORTATION);
        verify(needRepository).save(any(Need.class));
    }

    @Test
    void shouldRejectDuplicateApplication() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(applicationRepository.existsByNeedIdAndHelperId(need.getId(), helper.getId())).thenReturn(true);

        assertThatThrownBy(() -> needService.apply(helper.getId(), need.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already applied");
    }

    @Test
    void shouldRejectApplicationToClosedNeed() {
        Need need = buildNeed(elder, NeedStatus.ASSIGNED);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));

        assertThatThrownBy(() -> needService.apply(helper.getId(), need.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not open");
    }

    @Test
    void shouldAcceptHelper() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        NeedApplication app = NeedApplication.builder()
                .id(UUID.randomUUID()).need(need).helper(helper).status(ApplicationStatus.PENDING).build();

        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(applicationRepository.findByNeedIdAndHelperId(need.getId(), helper.getId())).thenReturn(Optional.of(app));
        when(applicationRepository.findByNeedId(need.getId())).thenReturn(List.of(app));
        when(needRepository.save(any(Need.class))).thenAnswer(i -> i.getArgument(0));
        // The DB always hands back a row with an id; the accepted-offer ping reads it.
        when(connectionRepository.save(any())).thenAnswer(i -> {
            Connection c = i.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });

        NeedResponse response = needService.acceptHelper(elder.getId(), need.getId(), helper.getId());

        assertThat(response.getStatus()).isEqualTo(NeedStatus.ASSIGNED);
        assertThat(app.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
    }

    @Test
    void shouldRejectAcceptByNonElder() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));

        assertThatThrownBy(() -> needService.acceptHelper(helper.getId(), need.getId(), helper.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only the elder");
    }

    @Test
    void shouldCompleteNeed() {
        Need need = buildNeed(elder, NeedStatus.ASSIGNED);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(needRepository.save(any(Need.class))).thenAnswer(i -> i.getArgument(0));

        NeedResponse response = needService.complete(elder.getId(), need.getId());

        assertThat(response.getStatus()).isEqualTo(NeedStatus.COMPLETED);
    }

    @Test
    void shouldGetMyNeedsPageable() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        Page<Need> page = new PageImpl<>(List.of(need));
        when(needRepository.findByElderIdOrderByCreatedAtDesc(eq(elder.getId()), any(Pageable.class))).thenReturn(page);

        Page<NeedResponse> result = needService.getMyNeeds(elder.getId(), 0, 10);

        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void shouldMarkMyApplicationStatusOnOpenNeeds() {
        Need applied = buildNeed(elder, NeedStatus.OPEN);
        Need untouched = buildNeed(elder, NeedStatus.OPEN);
        NeedApplication app = NeedApplication.builder()
                .id(UUID.randomUUID()).need(applied).helper(helper)
                .status(ApplicationStatus.PENDING).createdAt(java.time.LocalDateTime.now()).build();

        when(applicationRepository.findByHelperId(helper.getId())).thenReturn(List.of(app));
        when(needRepository.findByStatusOrderByCreatedAtDesc(eq(NeedStatus.OPEN), any(Pageable.class)))
                .thenReturn(List.of(applied, untouched));

        List<NeedResponse> result = needService.getAllOpen(helper.getId());

        NeedResponse appliedResp = result.stream().filter(r -> r.getId().equals(applied.getId())).findFirst().orElseThrow();
        NeedResponse untouchedResp = result.stream().filter(r -> r.getId().equals(untouched.getId())).findFirst().orElseThrow();
        assertThat(appliedResp.getMyApplicationStatus()).isEqualTo(ApplicationStatus.PENDING);
        assertThat(untouchedResp.getMyApplicationStatus()).isNull();
    }

    @Test
    void shouldGetMyApplicationsExcludingWithdrawn() {
        Need pendingNeed = buildNeed(elder, NeedStatus.OPEN);
        Need withdrawnNeed = buildNeed(elder, NeedStatus.OPEN);
        NeedApplication pending = NeedApplication.builder()
                .id(UUID.randomUUID()).need(pendingNeed).helper(helper)
                .status(ApplicationStatus.PENDING).createdAt(java.time.LocalDateTime.now()).build();
        NeedApplication withdrawn = NeedApplication.builder()
                .id(UUID.randomUUID()).need(withdrawnNeed).helper(helper)
                .status(ApplicationStatus.WITHDRAWN).createdAt(java.time.LocalDateTime.now().minusMinutes(5)).build();

        when(applicationRepository.findByHelperId(helper.getId())).thenReturn(List.of(pending, withdrawn));

        List<NeedResponse> result = needService.getMyApplications(helper.getId());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(pendingNeed.getId());
        assertThat(result.get(0).getMyApplicationStatus()).isEqualTo(ApplicationStatus.PENDING);
    }

    @Test
    void getAllOpen_looksUpElderNamesInOneBatchQuery() {
        Need one = buildNeed(elder, NeedStatus.OPEN);
        Need two = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findByStatusOrderByCreatedAtDesc(eq(NeedStatus.OPEN), any(Pageable.class)))
                .thenReturn(List.of(one, two));
        when(elderProfileRepository.findNamesByUserIds(anyCollection()))
                .thenReturn(List.<Object[]>of(new Object[]{elder.getId(), "Grace Elder"}));

        List<NeedResponse> result = needService.getAllOpen(helper.getId());

        assertThat(result).extracting(NeedResponse::getElderName).containsOnly("Grace Elder");
        verify(elderProfileRepository, times(1)).findNamesByUserIds(anyCollection());
        verify(elderProfileRepository, never()).findByUserId(any());
    }

    @Test
    void getAllOpen_boundsTheFeedToADefaultPageSize() {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(needRepository.findByStatusOrderByCreatedAtDesc(eq(NeedStatus.OPEN), pageable.capture()))
                .thenReturn(List.of());

        needService.getAllOpen(helper.getId());

        assertThat(pageable.getValue().getPageSize()).isEqualTo(NeedService.DEFAULT_PAGE_SIZE);
        verify(needRepository, never()).findByStatusOrderByCreatedAtDesc(any());
    }

    // HARD-106: a blocked elder's requests never reach the helper's feeds, and an
    // offer from a blocked helper is refused without saying why.
    @Test
    void getAllOpen_hidesRequestsFromAnyoneBlockedInEitherDirection() {
        User otherElder = buildUser(UUID.randomUUID(), UserRole.ELDER);
        Need hidden = buildNeed(elder, NeedStatus.OPEN);
        Need shown = buildNeed(otherElder, NeedStatus.OPEN);
        when(needRepository.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN))
                .thenReturn(List.of(hidden, shown));
        when(blockService.hiddenFor(helper.getId())).thenReturn(java.util.Set.of(elder.getId()));

        List<NeedResponse> result = needService.getAllOpen(helper.getId());

        assertThat(result).extracting(NeedResponse::getId).containsExactly(shown.getId());
    }

    @Test
    void browseNearby_hidesRequestsFromAnyoneBlockedInEitherDirection() {
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        User otherElder = buildUser(UUID.randomUUID(), UserRole.ELDER);
        Need hidden = buildNeed(elder, NeedStatus.OPEN);
        Need shown = buildNeed(otherElder, NeedStatus.OPEN);
        when(needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)).thenReturn(List.of(hidden, shown));
        when(blockService.hiddenFor(helper.getId())).thenReturn(java.util.Set.of(elder.getId()));

        List<NeedResponse> result = needService.browseNearby(helper.getId(), null, null, 50.0, 0, 20);

        assertThat(result).extracting(NeedResponse::getId).containsExactly(shown.getId());
    }

    @Test
    void acceptHelper_isRefusedAcrossABlock_soNoConnectionAndNoPushCrossIt() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(blockService.isHidden(elder.getId(), helper.getId())).thenReturn(true);

        assertThatThrownBy(() -> needService.acceptHelper(elder.getId(), need.getId(), helper.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(com.towinly.block.service.BlockService.NOT_AVAILABLE);
        verify(applicationRepository, never()).save(any());
        verify(connectionRepository, never()).save(any());
        verify(expoPushService, never()).sendToUser(any(), any(), any(), any());
    }

    @Test
    void getMyNeeds_dropsABlockedHelperFromTheApplicantList() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        User shown = buildUser(UUID.randomUUID(), UserRole.HELPER);
        NeedApplication fromHidden = NeedApplication.builder().id(UUID.randomUUID()).need(need).helper(helper)
                .message("Let me in").status(ApplicationStatus.PENDING).build();
        NeedApplication fromShown = NeedApplication.builder().id(UUID.randomUUID()).need(need).helper(shown)
                .message("Happy to help").status(ApplicationStatus.PENDING).build();
        when(needRepository.findByElderIdOrderByCreatedAtDesc(eq(elder.getId()), any(Pageable.class)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(need)));
        when(applicationRepository.findByNeedId(need.getId())).thenReturn(List.of(fromHidden, fromShown));
        when(blockService.hiddenFor(elder.getId())).thenReturn(java.util.Set.of(helper.getId()));

        NeedResponse response = needService.getMyNeeds(elder.getId(), 0, 20).getContent().get(0);

        assertThat(response.getApplications()).extracting(a -> a.getHelperId()).containsExactly(shown.getId());
    }

    @Test
    void getAllOpen_filtersBeforeThePageIsCut_soAPageIsNeverShortBecauseOfABlock() {
        User otherElder = buildUser(UUID.randomUUID(), UserRole.ELDER);
        List<Need> all = new java.util.ArrayList<>();
        for (int i = 0; i < NeedService.DEFAULT_PAGE_SIZE; i++) all.add(buildNeed(elder, NeedStatus.OPEN));
        Need visible = buildNeed(otherElder, NeedStatus.OPEN);
        all.add(visible);
        when(needRepository.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN)).thenReturn(all);
        when(blockService.hiddenFor(helper.getId())).thenReturn(java.util.Set.of(elder.getId()));

        List<NeedResponse> result = needService.getAllOpen(helper.getId());

        assertThat(result).extracting(NeedResponse::getId).containsExactly(visible.getId());
        verify(needRepository, never()).findByStatusOrderByCreatedAtDesc(eq(NeedStatus.OPEN), any(Pageable.class));
    }

    @Test
    void apply_isRefusedWhenEitherPersonBlockedTheOther_withoutSayingWhy() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(blockService.isHidden(helper.getId(), elder.getId())).thenReturn(true);

        assertThatThrownBy(() -> needService.apply(helper.getId(), need.getId(), null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(com.towinly.block.service.BlockService.NOT_AVAILABLE);
        verify(applicationRepository, never()).save(any());
    }

    // ── SEC-04: reading one request by its id ────────────────────────────────
    // Every other need read path already subtracts blocks and the open feed only
    // ever carries OPEN requests. getOne handed the title, description, elder name
    // and live status to anyone holding the id: a blocked helper who kept the id
    // from the feed, and a stranger polling a request that had long left it.

    // The pair asked about is the caller and the elder who posted, and isHidden is
    // the two-way question (BlockServiceTest.isHidden_asksTheRepositoryForEitherDirection),
    // so it makes no difference which of the two pressed block.
    @Test
    void getOne_isRefusedAcrossABlock_withoutSayingWhy() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(blockService.isHidden(helper.getId(), elder.getId())).thenReturn(true);

        assertThatThrownBy(() -> needService.getOne(helper.getId(), need.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(com.towinly.block.service.BlockService.NOT_AVAILABLE);
    }

    @Test
    void getOne_asksTheBlockQuestionAboutTheCallerAndThePostingElder() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));

        needService.getOne(helper.getId(), need.getId());

        verify(blockService).isHidden(helper.getId(), elder.getId());
    }

    @Test
    void getOne_stillReadsAnOpenRequestForAHelperWithNoBlock() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));

        NeedResponse response = needService.getOne(helper.getId(), need.getId());

        assertThat(response.getId()).isEqualTo(need.getId());
        assertThat(response.getTitle()).isEqualTo("Test Need");
        // Who applied stays the elder's business, exactly as before.
        assertThat(response.getApplications()).isNull();
    }

    // A request leaves /needs/open and /needs/nearby the moment it stops being
    // OPEN. Holding its id was a way to keep reading it: OPEN to ASSIGNED says a
    // stranger has been let into that named person's home, COMPLETED says when
    // they left, and the title often names the private thing itself.
    @Test
    void getOne_refusesAStrangerARequestThatHasLeftTheOpenFeed() {
        Need need = buildNeed(elder, NeedStatus.ASSIGNED);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(applicationRepository.existsByNeedIdAndHelperId(need.getId(), helper.getId())).thenReturn(false);

        assertThatThrownBy(() -> needService.getOne(helper.getId(), need.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void getOne_stillReadsAClosedRequestForTheHelperWhoOfferedOnIt() {
        Need need = buildNeed(elder, NeedStatus.ASSIGNED);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(applicationRepository.existsByNeedIdAndHelperId(need.getId(), helper.getId())).thenReturn(true);

        NeedResponse response = needService.getOne(helper.getId(), need.getId());

        assertThat(response.getId()).isEqualTo(need.getId());
        assertThat(response.getStatus()).isEqualTo(NeedStatus.ASSIGNED);
    }

    @Test
    void getOne_neverRefusesTheElderTheirOwnRequest() {
        Need need = buildNeed(elder, NeedStatus.CANCELLED);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));

        NeedResponse response = needService.getOne(elder.getId(), need.getId());

        assertThat(response.getId()).isEqualTo(need.getId());
        assertThat(response.getApplications()).isNotNull();
        verify(blockService, never()).isHidden(any(), any());
        verify(applicationRepository, never()).existsByNeedIdAndHelperId(any(), any());
    }

    @Test
    void getOne_dropsABlockedHelperFromTheApplicantListItHandsTheOwner() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        User shown = buildUser(UUID.randomUUID(), UserRole.HELPER);
        NeedApplication fromHidden = NeedApplication.builder().id(UUID.randomUUID()).need(need).helper(helper)
                .message("Let me in").status(ApplicationStatus.PENDING).build();
        NeedApplication fromShown = NeedApplication.builder().id(UUID.randomUUID()).need(need).helper(shown)
                .message("Happy to help").status(ApplicationStatus.PENDING).build();
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(applicationRepository.findByNeedId(need.getId())).thenReturn(List.of(fromHidden, fromShown));
        when(blockService.hiddenFor(elder.getId())).thenReturn(java.util.Set.of(helper.getId()));

        NeedResponse response = needService.getOne(elder.getId(), need.getId());

        assertThat(response.getApplications()).extracting(a -> a.getHelperId()).containsExactly(shown.getId());
    }

    private User buildUser(UUID id, UserRole role) {
        return User.builder()
                .id(id).email(id + "@test.com").phone("+1234567890")
                .passwordHash("hash").role(role).trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE).isActive(true).build();
    }

    private Need buildNeed(User elder, NeedStatus status) {
        return Need.builder()
                .id(UUID.randomUUID()).elder(elder).title("Test Need")
                .category(NeedCategory.ERRANDS).status(status)
                .locationLat(BigDecimal.valueOf(43.65)).locationLng(BigDecimal.valueOf(-79.38)).build();
    }


    // ── SEC-01: coarse on the server, banded on the wire ─────────────────────

    @Test
    void postNeed_storesTheCellNotTheRawFix() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(needRepository.save(any(Need.class))).thenAnswer(i -> i.getArgument(0));
        NeedRequest request = new NeedRequest();
        request.setTitle("Groceries");
        request.setCategory(NeedCategory.ERRANDS);
        request.setLocationLat(43.6532);
        request.setLocationLng(-79.3832);

        needService.postNeed(elder.getId(), request);

        org.mockito.ArgumentCaptor<Need> saved = org.mockito.ArgumentCaptor.forClass(Need.class);
        verify(needRepository).save(saved.capture());
        assertThat(saved.getValue().getLocationLat()).isEqualByComparingTo("43.66");
        assertThat(saved.getValue().getLocationLng()).isEqualByComparingTo("-79.38");
    }

    @Test
    void browseNearby_returnsBandedDistancesNotAHundredMetreFloat() {
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        Need close = buildNeed(elder, NeedStatus.OPEN);                       // next cell west, ~1.6 km
        Need farther = buildNeed(elder, NeedStatus.OPEN);
        farther.setLocationLat(BigDecimal.valueOf(43.75));                    // ~11 km north
        when(needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)).thenReturn(List.of(farther, close));

        List<NeedResponse> result = needService.browseNearby(helper.getId(), null, null, 50.0, 0, 20);

        assertThat(result).extracting(NeedResponse::getDistanceKm).containsExactly(2.0, 20.0);
    }

    @Test
    void browseNearby_ignoresAnOriginFarFromTheHelpersOwnCell() {
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        Need close = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)).thenReturn(List.of(close));

        List<NeedResponse> result = needService.browseNearby(helper.getId(), 44.66, -79.39, 500.0, 0, 20);

        assertThat(result.get(0).getDistanceKm()).isEqualTo(2.0);
    }
}
