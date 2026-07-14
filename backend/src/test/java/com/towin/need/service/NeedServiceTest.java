package com.towin.need.service;

import com.towin.common.entity.User;
import com.towin.common.enums.*;
import com.towin.need.dto.NeedRequest;
import com.towin.need.dto.NeedResponse;
import com.towin.need.entity.Need;
import com.towin.need.entity.NeedApplication;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.common.repository.UserRepository;
import com.towin.profile.repository.ElderProfileRepository;
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
    @Mock com.towin.profile.repository.HelperProfileRepository helperProfileRepository;
    @Mock com.towin.common.service.S3Service s3Service;
    @Mock com.towin.common.service.TrustScoreService trustScoreService;
    @Mock com.towin.connection.repository.ConnectionRepository connectionRepository;
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
                trustScoreService, connectionRepository, Optional.empty());
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
}
