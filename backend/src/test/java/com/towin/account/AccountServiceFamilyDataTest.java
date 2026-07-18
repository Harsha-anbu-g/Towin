package com.towin.account;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.repository.EmergencyContactRepository;
import com.towin.family.entity.FamilyAlert;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyAlertRepository;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.messaging.repository.MessageRepository;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

/**
 * US-009: GDPR export includes family links (both directions, all statuses) and,
 * for elders, their family alerts; the purge cascade removes family rows whether
 * the user sits on the elder side or the family side of a link.
 */
class AccountServiceFamilyDataTest {

    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock ReportRepository reportRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository needApplicationRepository;
    @Mock MessageRepository messageRepository;
    @Mock EmergencyContactRepository emergencyContactRepository;
    @Mock TrustProgressionLogRepository trustProgressionLogRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyAlertRepository familyAlertRepository;
    @Mock S3Service s3Service;

    @InjectMocks AccountService accountService;

    UUID elderId = UUID.randomUUID();
    UUID familyMemberId = UUID.randomUUID();
    User elder;
    User familyMember;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        elder = User.builder()
                .id(elderId).email("elder@test.com").username("elder1")
                .role(UserRole.ELDER).build();
        familyMember = User.builder()
                .id(familyMemberId).email("daughter@test.com").username("daughter1")
                .role(UserRole.FAMILY).build();
        when(userRepository.findById(elderId)).thenReturn(Optional.of(elder));
        when(userRepository.findById(familyMemberId)).thenReturn(Optional.of(familyMember));
        when(needRepository.findByElderIdOrderByCreatedAtDesc(any(UUID.class), any(Pageable.class)))
                .thenReturn(Page.empty());
    }

    // ── purge cascade ────────────────────────────────────────────────────────

    @Test
    void purgingAnElderRemovesTheirFamilyAlertsAndLinks() {
        accountService.purgeUserData(elderId);

        InOrder order = inOrder(familyAlertRepository, familyLinkRepository, userRepository);
        order.verify(familyAlertRepository).deleteByElderId(elderId);
        order.verify(familyLinkRepository).deleteByElderIdOrFamilyUserId(elderId, elderId);
        order.verify(userRepository).delete(elder);
    }

    @Test
    void purgingAFamilyMemberRemovesTheirLinksBeforeTheUserRow() {
        accountService.purgeUserData(familyMemberId);

        InOrder order = inOrder(familyLinkRepository, userRepository);
        // Removes only rows where they participate (they are never the elder,
        // so deleteByElderId is a no-op for them at the DB level).
        order.verify(familyLinkRepository)
                .deleteByElderIdOrFamilyUserId(familyMemberId, familyMemberId);
        order.verify(userRepository).delete(familyMember);
    }

    // ── export ───────────────────────────────────────────────────────────────

    @Test
    void exportIncludesFamilyLinksFromBothDirectionsAndAllStatuses() {
        FamilyLink asElder = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(familyMember)
                .initiatedBy(elder).relationship("Daughter")
                .status(FamilyLinkStatus.ACTIVE).isPrimary(true)
                .respondedAt(LocalDateTime.now())
                .build();
        FamilyLink asFamilySide = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(familyMember).familyUser(elder)
                .initiatedBy(elder).relationship("Uncle")
                .status(FamilyLinkStatus.REVOKED)
                .revokedAt(LocalDateTime.now())
                .build();
        when(familyLinkRepository.findByElderIdOrFamilyUserId(elderId, elderId))
                .thenReturn(List.of(asElder, asFamilySide));

        Map<String, Object> export = accountService.exportUserData(elderId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> links = (List<Map<String, Object>>) export.get("familyLinks");
        assertThat(links).hasSize(2);
        assertThat(links.get(0).get("elderId")).isEqualTo(elderId);
        assertThat(links.get(0).get("familyUserId")).isEqualTo(familyMemberId);
        assertThat(links.get(0).get("relationship")).isEqualTo("Daughter");
        assertThat(links.get(0).get("status")).isEqualTo("ACTIVE");
        assertThat(links.get(0).get("isPrimary")).isEqualTo(true);
        assertThat(links.get(1).get("status")).isEqualTo("REVOKED");
        assertThat(links.get(1).get("elderId")).isEqualTo(familyMemberId);
    }

    @Test
    void exportIncludesTheEldersOwnFamilyAlerts() {
        FamilyAlert alert = FamilyAlert.builder()
                .id(UUID.randomUUID()).elder(elder)
                .type("SOS").body("Meena pressed the SOS button.")
                .build();
        when(familyAlertRepository.findByElderIdOrderByCreatedAtDesc(eq(elderId)))
                .thenReturn(List.of(alert));

        Map<String, Object> export = accountService.exportUserData(elderId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> alerts = (List<Map<String, Object>>) export.get("familyAlerts");
        assertThat(alerts).hasSize(1);
        assertThat(alerts.get(0).get("type")).isEqualTo("SOS");
        assertThat(alerts.get(0).get("body")).isEqualTo("Meena pressed the SOS button.");
    }

    @Test
    void exportReturnsEmptyFamilySectionsForUsersWithNoFamilyData() {
        Map<String, Object> export = accountService.exportUserData(familyMemberId);

        assertThat((List<?>) export.get("familyLinks")).isEmpty();
        assertThat((List<?>) export.get("familyAlerts")).isEmpty();
    }
}
