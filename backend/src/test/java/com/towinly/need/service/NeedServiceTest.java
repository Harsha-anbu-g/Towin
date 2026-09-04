package com.towinly.need.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.*;
import com.towinly.common.web.PageLimits;
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
import org.springframework.data.domain.PageRequest;
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

    // HARD-106 (SEC-04): every other need read path subtracts blocks; getOne did not,
    // so a blocked helper holding the id from the open feed kept reading the elder's
    // request content and its live status.
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
    void getOne_stillReachesAHelperWithNoBlock() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));

        NeedResponse response = needService.getOne(helper.getId(), need.getId());

        assertThat(response.getId()).isEqualTo(need.getId());
        assertThat(response.getApplications()).isNull();
    }

    @Test
    void getOne_stillReachesThePostingElder() {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));

        NeedResponse response = needService.getOne(elder.getId(), need.getId());

        assertThat(response.getId()).isEqualTo(need.getId());
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

    // ── R2 (1): the applications list is /needs/{id} by another route ────────
    // SEC-04 closed GET /needs/{id}. GET /needs/applications hands a helper the
    // very same fields for every request they ever offered on — title,
    // description, elder name and the LIVE status — and the shipped app polls it.

    @Test
    void getMyApplications_dropsTheRequestsOfAnyoneBlockedInEitherDirection() {
        User otherElder = buildUser(UUID.randomUUID(), UserRole.ELDER);
        Need hiddenNeed = buildNeed(elder, NeedStatus.ASSIGNED);
        hiddenNeed.setTitle("Change my catheter dressing");
        hiddenNeed.setDescription("Front door code is 4417");
        Need shownNeed = buildNeed(otherElder, NeedStatus.OPEN);
        NeedApplication onHidden = NeedApplication.builder()
                .id(UUID.randomUUID()).need(hiddenNeed).helper(helper)
                .status(ApplicationStatus.ACCEPTED).createdAt(java.time.LocalDateTime.now()).build();
        NeedApplication onShown = NeedApplication.builder()
                .id(UUID.randomUUID()).need(shownNeed).helper(helper)
                .status(ApplicationStatus.PENDING).createdAt(java.time.LocalDateTime.now().minusMinutes(5)).build();
        when(applicationRepository.findByHelperId(helper.getId())).thenReturn(List.of(onHidden, onShown));
        when(blockService.hiddenFor(helper.getId())).thenReturn(java.util.Set.of(elder.getId()));

        List<NeedResponse> result = needService.getMyApplications(helper.getId());

        assertThat(result).extracting(NeedResponse::getId).containsExactly(shownNeed.getId());
        assertThat(result).extracting(NeedResponse::getTitle).doesNotContain("Change my catheter dressing");
        assertThat(result).extracting(NeedResponse::getDescription).doesNotContain("Front door code is 4417");
        assertThat(result).extracting(NeedResponse::getElderId).doesNotContain(elder.getId());
        assertThat(result).extracting(NeedResponse::getStatus).doesNotContain(NeedStatus.ASSIGNED);
    }

    @Test
    void getMyApplications_keepsEveryOfferThatNoBlockStandsOn() {
        Need mine = buildNeed(elder, NeedStatus.ASSIGNED);
        NeedApplication app = NeedApplication.builder()
                .id(UUID.randomUUID()).need(mine).helper(helper)
                .status(ApplicationStatus.ACCEPTED).createdAt(java.time.LocalDateTime.now()).build();
        when(applicationRepository.findByHelperId(helper.getId())).thenReturn(List.of(app));

        List<NeedResponse> result = needService.getMyApplications(helper.getId());

        assertThat(result).extracting(NeedResponse::getId).containsExactly(mine.getId());
        assertThat(result.get(0).getMyApplicationStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
    }

    // ── R2 (2): a resurrected friendship never keeps the rung it died on ─────
    // acceptHelper reuses whatever row already joins the pair. Brought back to
    // ACTIVE with its old rung, a turned-down request pays out everything that
    // rung unlocks with no ladder step taken — sharpest with the score head
    // start, which stands a brand-new request at Phone Ready.

    @Test
    void acceptHelper_bringsADeclinedRequestBackAtTheBottomRung_soNoPhoneOpens() {
        Connection saved = acceptWithExistingConnection(ConnectionStatus.DECLINED, TrustLevel.PHONE_CALL);

        assertThat(saved.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
        assertThat(saved.getCurrentTrustLevel()).isEqualTo(TrustLevel.DISCOVERED);
    }

    @Test
    void acceptHelper_bringsAnUnansweredRequestBackAtTheBottomRung() {
        Connection saved = acceptWithExistingConnection(ConnectionStatus.PENDING, TrustLevel.PHONE_CALL);

        assertThat(saved.getCurrentTrustLevel()).isEqualTo(TrustLevel.DISCOVERED);
    }

    @Test
    void acceptHelper_bringsAnEndedFriendshipBackAtTheBottomRung() {
        Connection saved = acceptWithExistingConnection(ConnectionStatus.ENDED, TrustLevel.TRUSTED);

        assertThat(saved.getCurrentTrustLevel()).isEqualTo(TrustLevel.DISCOVERED);
    }

    @Test
    void acceptHelper_leavesALiveFriendshipsRungExactlyWhereItWas() {
        Connection saved = acceptWithExistingConnection(ConnectionStatus.ACTIVE, TrustLevel.VERIFIED);

        assertThat(saved.getCurrentTrustLevel()).isEqualTo(TrustLevel.VERIFIED);
    }

    // A pause is reversible by design: TrustService.resumeProgression hands the
    // same rung back on one press, and the app's pause promises nothing is lost.
    // Wiping the ladder here would destroy earned trust, not protect anybody.
    @Test
    void acceptHelper_leavesAPausedFriendshipsRungExactlyWhereItWas() {
        Connection saved = acceptWithExistingConnection(ConnectionStatus.PAUSED, TrustLevel.TRUSTED);

        assertThat(saved.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
        assertThat(saved.getCurrentTrustLevel()).isEqualTo(TrustLevel.TRUSTED);
    }

    /** Accepts this helper on a fresh open request when the pair already have a row. */
    private Connection acceptWithExistingConnection(ConnectionStatus status, TrustLevel rung) {
        Need need = buildNeed(elder, NeedStatus.OPEN);
        NeedApplication app = NeedApplication.builder()
                .id(UUID.randomUUID()).need(need).helper(helper).status(ApplicationStatus.PENDING).build();
        Connection existing = Connection.builder()
                .id(UUID.randomUUID()).userA(elder).userB(helper)
                .type(ConnectionType.SOCIAL).initiatedBy(helper)
                .currentTrustLevel(rung).status(status).build();
        when(needRepository.findById(need.getId())).thenReturn(Optional.of(need));
        when(applicationRepository.findByNeedIdAndHelperId(need.getId(), helper.getId())).thenReturn(Optional.of(app));
        when(applicationRepository.findByNeedId(need.getId())).thenReturn(List.of(app));
        when(connectionRepository.findAllBetweenUsers(elder.getId(), helper.getId())).thenReturn(java.util.List.of(existing));
        when(needRepository.save(any(Need.class))).thenAnswer(i -> i.getArgument(0));
        when(connectionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        needService.acceptHelper(elder.getId(), need.getId(), helper.getId());

        ArgumentCaptor<Connection> saved = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(saved.capture());
        return saved.getValue();
    }

    // ── R2 (3): the browse routes are the server's decision, not the caller's ─
    // SEC-07 clamped /api/discover and left PageLimits with one consumer, so
    // ?size=100000&radiusKm=100000 still worked here.

    @Test
    void browseNearby_clampsAPageSizeBiggerThanTheServerAllows() {
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        List<Need> many = new java.util.ArrayList<>();
        for (int i = 0; i < PageLimits.MAX_PAGE_SIZE + 20; i++) many.add(buildNeed(elder, NeedStatus.OPEN));
        when(needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)).thenReturn(many);

        List<NeedResponse> result = needService.browseNearby(helper.getId(), null, null, 10.0, 0, 100000);

        assertThat(result).hasSize(PageLimits.MAX_PAGE_SIZE);
    }

    @Test
    void browseNearby_clampsARadiusWiderThanTheServerAllows() {
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        Need farAway = buildNeed(elder, NeedStatus.OPEN);
        farAway.setLocationLat(BigDecimal.valueOf(45.65));   // ~220 km north of the helper
        when(needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)).thenReturn(List.of(farAway));

        List<NeedResponse> result = needService.browseNearby(helper.getId(), null, null, 100000.0, 0, 20);

        assertThat(result).isEmpty();
    }

    @Test
    void browseNearby_answersNormallyWhenThePageNumberIsNegative() {
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        Need near = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)).thenReturn(List.of(near));

        List<NeedResponse> result = needService.browseNearby(helper.getId(), null, null, 10.0, -1, 20);

        assertThat(result).extracting(NeedResponse::getId).containsExactly(near.getId());
    }

    @Test
    void browseNearby_fallsBackToTheDefaultRadiusWhenNoneIsGiven() {
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        Need near = buildNeed(elder, NeedStatus.OPEN);
        when(needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)).thenReturn(List.of(near));

        List<NeedResponse> result = needService.browseNearby(helper.getId(), null, null, null, 0, 20);

        assertThat(result).extracting(NeedResponse::getId).containsExactly(near.getId());
    }

    @Test
    void getMyNeeds_clampsAnOversizedPageSizeAndANegativePage() {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(needRepository.findByElderIdOrderByCreatedAtDesc(eq(elder.getId()), pageable.capture()))
                .thenReturn(new PageImpl<>(List.of()));

        needService.getMyNeeds(elder.getId(), -3, 100000);

        assertThat(pageable.getValue().getPageSize()).isEqualTo(PageLimits.MAX_PAGE_SIZE);
        assertThat(pageable.getValue().getPageNumber()).isZero();
    }

    @Test
    void getAllOpen_clampsAPageSizeBiggerThanTheServerAllows() {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(needRepository.findByStatusOrderByCreatedAtDesc(eq(NeedStatus.OPEN), pageable.capture()))
                .thenReturn(List.of());

        needService.getAllOpen(helper.getId(), PageRequest.of(0, 100000));

        assertThat(pageable.getValue().getPageSize()).isEqualTo(PageLimits.MAX_PAGE_SIZE);
    }

    @Test
    void getAllOpen_answersAnUnpagedRequestWithOnePageRatherThanTheWholeTable() {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(needRepository.findByStatusOrderByCreatedAtDesc(eq(NeedStatus.OPEN), pageable.capture()))
                .thenReturn(List.of());

        needService.getAllOpen(helper.getId(), Pageable.unpaged());

        assertThat(pageable.getValue().isPaged()).isTrue();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(NeedService.DEFAULT_PAGE_SIZE);
    }
}
