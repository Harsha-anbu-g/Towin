package com.towin.account;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.NeedCategory;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.entity.EmergencyContact;
import com.towin.emergency.repository.EmergencyContactRepository;
import com.towin.messaging.repository.MessageRepository;
import com.towin.need.entity.Need;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AccountServiceTest {

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
    @Mock S3Service s3Service;

    @InjectMocks AccountService accountService;

    UUID userId = UUID.randomUUID();
    User user;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        user = User.builder()
                .id(userId)
                .email("elder@test.com")
                .username("elder1")
                .phone("+911234567890")
                .passwordHash("secret-hash")
                .role(UserRole.ELDER)
                .trustScore(5.0)
                .isActive(true)
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(needRepository.findByElderIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(Page.empty());
    }

    // ── purgeUserData / deleteOwnAccount ─────────────────────────────────────

    @Test
    void purge_throwsAndDeletesNothingWhenUserMissing() {
        UUID unknown = UUID.randomUUID();
        when(userRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.purgeUserData(unknown))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");

        verify(userRepository, never()).delete(any(User.class));
        verifyNoInteractions(messageRepository, connectionRepository, reviewRepository, s3Service);
    }

    @Test
    void purge_deletesEveryRecordCategoryForTheUser() {
        accountService.purgeUserData(userId);

        verify(messageRepository).deleteByConnectionUserIdOrSenderId(userId);
        verify(reviewRepository).deleteByReviewerIdOrRevieweeId(userId, userId);
        verify(reportRepository).deleteByReporterIdOrReportedUserId(userId, userId);
        verify(needApplicationRepository).deleteByHelperId(userId);
        verify(needRepository).deleteByElderId(userId);
        verify(emergencyContactRepository).deleteByElderId(userId);
        verify(trustProgressionLogRepository).deleteByUserId(userId);
        verify(connectionRepository).deleteByUserId(userId);
        verify(elderProfileRepository).deleteByUserId(userId);
        verify(helperProfileRepository).deleteByUserId(userId);
        verify(userRepository).delete(user);
    }

    @Test
    void purge_deletesDependentsBeforeConnectionsAndUserRowLast() {
        // Messages and trust logs reference connections; profiles reference the
        // user. Deleting out of order would blow up on foreign keys in prod.
        accountService.purgeUserData(userId);

        InOrder order = inOrder(messageRepository, trustProgressionLogRepository,
                connectionRepository, elderProfileRepository, helperProfileRepository, userRepository);
        order.verify(messageRepository).deleteByConnectionUserIdOrSenderId(userId);
        order.verify(trustProgressionLogRepository).deleteByUserId(userId);
        order.verify(connectionRepository).deleteByUserId(userId);
        order.verify(elderProfileRepository).deleteByUserId(userId);
        order.verify(helperProfileRepository).deleteByUserId(userId);
        order.verify(userRepository).delete(user);
    }

    @Test
    void purge_deletesApplicationsOnEachPostedNeedBeforeTheNeeds() {
        Need needOne = need("Buy groceries");
        Need needTwo = need("Fix the tap");
        when(needRepository.findByElderIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(needOne, needTwo)));

        accountService.purgeUserData(userId);

        InOrder order = inOrder(needApplicationRepository, needRepository);
        order.verify(needApplicationRepository).deleteByNeedId(needOne.getId());
        order.verify(needApplicationRepository).deleteByNeedId(needTwo.getId());
        order.verify(needRepository).deleteByElderId(userId);
    }

    @Test
    void purge_removesProfilePhotoAndIdDocumentFromS3() {
        user.setIdDocumentUrl("s3://id-doc");
        when(elderProfileRepository.findByUserId(userId))
                .thenReturn(Optional.of(elderProfile("s3://elder-photo")));

        accountService.purgeUserData(userId);

        verify(s3Service).deleteFile("s3://elder-photo");
        verify(s3Service).deleteFile("s3://id-doc");
    }

    @Test
    void purge_fallsBackToHelperPhotoWhenNoElderPhoto() {
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(userId))
                .thenReturn(Optional.of(helperProfile("s3://helper-photo")));

        accountService.purgeUserData(userId);

        verify(s3Service).deleteFile("s3://helper-photo");
    }

    @Test
    void purge_touchesNoS3FilesWhenUserHasNone() {
        accountService.purgeUserData(userId);

        verifyNoInteractions(s3Service);
    }

    @Test
    void deleteOwnAccount_runsTheFullPurge() {
        accountService.deleteOwnAccount(userId);

        verify(connectionRepository).deleteByUserId(userId);
        verify(userRepository).delete(user);
    }

    // ── exportUserData ───────────────────────────────────────────────────────

    @Test
    void export_throwsWhenUserMissing() {
        UUID unknown = UUID.randomUUID();
        when(userRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> accountService.exportUserData(unknown))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void export_includesAccountFieldsButNeverSecrets() {
        Map<String, Object> export = accountService.exportUserData(userId);

        @SuppressWarnings("unchecked")
        Map<String, Object> account = (Map<String, Object>) export.get("account");
        assertThat(account.get("id")).isEqualTo(userId);
        assertThat(account.get("email")).isEqualTo("elder@test.com");
        assertThat(account.get("username")).isEqualTo("elder1");
        assertThat(account.get("role")).isEqualTo("ELDER");
        assertThat(account.get("trustScore")).isEqualTo(5.0);
        // A GDPR export must not leak credentials or tokens.
        assertThat(account).doesNotContainKeys(
                "passwordHash", "phoneOtp", "emailVerificationToken", "passwordResetToken");
    }

    @Test
    void export_omitsProfileSectionsWhenUserHasNoProfiles() {
        Map<String, Object> export = accountService.exportUserData(userId);

        assertThat(export).doesNotContainKeys("elderProfile", "helperProfile");
    }

    @Test
    void export_includesBothProfilesWhenPresent() {
        when(elderProfileRepository.findByUserId(userId))
                .thenReturn(Optional.of(elderProfile("s3://photo")));
        when(helperProfileRepository.findByUserId(userId))
                .thenReturn(Optional.of(helperProfile("s3://photo")));

        Map<String, Object> export = accountService.exportUserData(userId);

        @SuppressWarnings("unchecked")
        Map<String, Object> elder = (Map<String, Object>) export.get("elderProfile");
        assertThat(elder.get("name")).isEqualTo("Meena");
        assertThat(elder.get("age")).isEqualTo(70);
        @SuppressWarnings("unchecked")
        Map<String, Object> helper = (Map<String, Object>) export.get("helperProfile");
        assertThat(helper.get("name")).isEqualTo("Ravi");
    }

    @Test
    void export_collectsNeedsReviewsContactsAndConnections() {
        Need need = need("Buy groceries");
        when(needRepository.findByElderIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(need)));
        Review given = Review.builder().rating(4).comment("kind").build();
        Review received = Review.builder().rating(5).comment("wonderful").build();
        when(reviewRepository.findByReviewerIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(given));
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(received));
        EmergencyContact contact = EmergencyContact.builder()
                .name("Daughter").phone("+911111111111").relationship("child").build();
        when(emergencyContactRepository.findByElderId(userId)).thenReturn(List.of(contact));
        Connection connection = Connection.builder()
                .id(UUID.randomUUID())
                .status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.MESSAGING)
                .build();
        when(connectionRepository.findAllByUser(userId)).thenReturn(List.of(connection));

        Map<String, Object> export = accountService.exportUserData(userId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> needs = (List<Map<String, Object>>) export.get("needsPosted");
        assertThat(needs).hasSize(1);
        assertThat(needs.get(0).get("title")).isEqualTo("Buy groceries");
        assertThat(needs.get(0).get("category")).isEqualTo(NeedCategory.ERRANDS.name());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> reviewsGiven = (List<Map<String, Object>>) export.get("reviewsGiven");
        assertThat(reviewsGiven.get(0).get("rating")).isEqualTo(4);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> reviewsReceived = (List<Map<String, Object>>) export.get("reviewsReceived");
        assertThat(reviewsReceived.get(0).get("comment")).isEqualTo("wonderful");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contacts = (List<Map<String, Object>>) export.get("emergencyContacts");
        assertThat(contacts.get(0).get("name")).isEqualTo("Daughter");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> connections = (List<Map<String, Object>>) export.get("connections");
        assertThat(connections.get(0).get("status")).isEqualTo("ACTIVE");
        assertThat(connections.get(0).get("trustLevel")).isEqualTo("MESSAGING");
    }

    @Test
    void export_returnsEmptyCollectionsForABrandNewUser() {
        when(reviewRepository.findByReviewerIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        when(emergencyContactRepository.findByElderId(userId)).thenReturn(List.of());
        when(connectionRepository.findAllByUser(userId)).thenReturn(List.of());

        Map<String, Object> export = accountService.exportUserData(userId);

        assertThat((List<?>) export.get("needsPosted")).isEmpty();
        assertThat((List<?>) export.get("reviewsGiven")).isEmpty();
        assertThat((List<?>) export.get("reviewsReceived")).isEmpty();
        assertThat((List<?>) export.get("emergencyContacts")).isEmpty();
        assertThat((List<?>) export.get("connections")).isEmpty();
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    private Need need(String title) {
        return Need.builder()
                .id(UUID.randomUUID())
                .elder(user)
                .title(title)
                .category(NeedCategory.ERRANDS)
                .build();
    }

    private ElderProfile elderProfile(String photoUrl) {
        return ElderProfile.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name("Meena")
                .age(70)
                .photoUrl(photoUrl)
                .build();
    }

    private HelperProfile helperProfile(String photoUrl) {
        return HelperProfile.builder()
                .id(UUID.randomUUID())
                .user(user)
                .name("Ravi")
                .age(30)
                .photoUrl(photoUrl)
                .build();
    }
}
