package com.towin.admin;

import com.towin.account.AccountService;
import com.towin.admin.dto.*;
import com.towin.common.entity.User;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.common.seed.DemoDataSeeder;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.messaging.repository.MessageRepository;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.repository.TrustProgressionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    // The panel searches and pages its lists client-side (20 rows a page), so a page of
    // 100 keeps today's behaviour while the payload stops growing with the table.
    // Pass ?page=&size= to read further.
    public static final int DEFAULT_PAGE_SIZE = 100;

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ReportRepository reportRepository;
    private final ConnectionRepository connectionRepository;
    private final NeedRepository needRepository;
    private final NeedApplicationRepository needApplicationRepository;
    private final MessageRepository messageRepository;
    private final TrustProgressionLogRepository trustProgressionLogRepository;
    private final S3Service s3Service;
    private final TrustScoreService trustScoreService;
    private final AccountService accountService;
    // ObjectProvider because the seeder bean only exists when app.demo.seed-enabled=true.
    private final ObjectProvider<DemoDataSeeder> demoDataSeeder;

    /** Newest first, one bounded page — the default the panel gets when it asks for no page. */
    private static Pageable defaultPage() {
        return PageRequest.of(0, DEFAULT_PAGE_SIZE, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    public List<AdminUserResponse> getAllUsers() {
        return getAllUsers(defaultPage());
    }

    public List<AdminUserResponse> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable).getContent().stream()
                .map(u -> AdminUserResponse.builder()
                        .id(u.getId())
                        .username(u.getUsername())
                        .email(u.getEmail())
                        .role(u.getRole().name())
                        .trustScore(u.getTrustScore() != null ? (int) Math.round(u.getTrustScore()) : 0)
                        .trustTier(TrustScoreService.tierFor(u.getTrustScore() != null ? (int) Math.round(u.getTrustScore()) : 0))
                        .isActive(u.getIsActive())
                        .verificationStatus(u.getVerificationStatus().name())
                        .phoneVerified(u.isPhoneVerified())
                        .photoUrl(getPhotoUrl(u.getId()))
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    private String getPhotoUrl(UUID userId) {
        var elder = elderProfileRepository.findByUserId(userId).orElse(null);
        if (elder != null) return s3Service.presignedUrl(elder.getPhotoUrl());
        var helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null) return s3Service.presignedUrl(helper.getPhotoUrl());
        return null;
    }

    @Transactional
    public void suspendUser(UUID userId) {
        User user = getUser(userId);
        // Admins must never be suspendable: a suspended account can still log in but is
        // blocked from every admin API call, so suspending an admin locks it out of the
        // very panel needed to reverse it. Mirror the delete guard, which already
        // protects admin accounts.
        if (user.getRole() == com.towin.common.enums.UserRole.ADMIN) {
            throw new IllegalArgumentException("Cannot suspend an admin account");
        }
        user.setIsActive(false);
        userRepository.save(user);
    }

    @Transactional
    public void unsuspendUser(UUID userId) {
        User user = getUser(userId);
        user.setIsActive(true);
        userRepository.save(user);
    }

    @Transactional
    public void deleteUserPhoto(UUID userId) {
        var elder = elderProfileRepository.findByUserId(userId).orElse(null);
        if (elder != null && elder.getPhotoUrl() != null) {
            s3Service.deleteFile(elder.getPhotoUrl());
            elder.setPhotoUrl(null);
            elderProfileRepository.save(elder);
            return;
        }
        var helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null && helper.getPhotoUrl() != null) {
            s3Service.deleteFile(helper.getPhotoUrl());
            helper.setPhotoUrl(null);
            helperProfileRepository.save(helper);
        }
    }

    @Transactional
    public void deleteUser(UUID adminId, UUID userId) {
        if (adminId.equals(userId)) {
            throw new IllegalArgumentException("Cannot delete your own admin account");
        }
        User user = getUser(userId);
        if (user.getRole() == com.towin.common.enums.UserRole.ADMIN) {
            throw new IllegalArgumentException("Cannot delete another admin account");
        }
        // The full cascade lives in AccountService so the admin delete and the
        // self-service delete can never clean up different sets of records.
        accountService.purgeUserData(userId);
    }

    public List<AdminVerificationResponse> getPendingVerifications() {
        return getPendingVerifications(defaultPage());
    }

    public List<AdminVerificationResponse> getPendingVerifications(Pageable pageable) {
        return userRepository.findByVerificationStatus(VerificationStatus.PENDING, pageable)
                .stream()
                .map(u -> AdminVerificationResponse.builder()
                        .userId(u.getId())
                        .email(u.getEmail())
                        .idDocumentUrl(u.getIdDocumentUrl())
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void approveVerification(UUID userId) {
        User user = getUser(userId);
        user.setVerificationStatus(VerificationStatus.VERIFIED);
        userRepository.save(user);
        trustScoreService.recalculate(userId);
    }

    @Transactional
    public void rejectVerification(UUID userId) {
        User user = getUser(userId);
        if (user.getIdDocumentUrl() != null) {
            s3Service.deleteFile(user.getIdDocumentUrl());
            user.setIdDocumentUrl(null);
        }
        user.setVerificationStatus(VerificationStatus.REJECTED);
        userRepository.save(user);
    }

    public List<AdminReportResponse> getAllReports() {
        return getAllReports(defaultPage());
    }

    public List<AdminReportResponse> getAllReports(Pageable pageable) {
        return reportRepository.findAllWithUsers(pageable).stream()
                .map(r -> AdminReportResponse.builder()
                        .id(r.getId())
                        .reporterEmail(r.getReporter().getEmail())
                        .reportedEmail(r.getReportedUser().getEmail())
                        .reason(r.getReason())
                        .description(r.getDescription())
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteReport(UUID reportId) {
        reportRepository.deleteById(reportId);
    }

    public List<AdminReviewResponse> getAllReviews(boolean safetyConcernOnly) {
        return getAllReviews(safetyConcernOnly, defaultPage());
    }

    public List<AdminReviewResponse> getAllReviews(boolean safetyConcernOnly, Pageable pageable) {
        var reviews = safetyConcernOnly
                ? reviewRepository.findBySafetyConcernTrue(pageable)
                : reviewRepository.findAll(pageable).getContent();
        return reviews.stream()
                .map(r -> AdminReviewResponse.builder()
                        .id(r.getId())
                        .reviewerEmail(r.getReviewer().getEmail())
                        .revieweeEmail(r.getReviewee().getEmail())
                        .rating(r.getRating())
                        .tags(r.getTags() != null ? r.getTags().toArray(new String[0]) : null)
                        .comment(r.getComment())
                        .safetyConcern(Boolean.TRUE.equals(r.getSafetyConcern()))
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteReview(UUID reviewId) {
        reviewRepository.deleteById(reviewId);
    }

    public List<AdminConnectionResponse> getAllConnections() {
        return getAllConnections(defaultPage());
    }

    public List<AdminConnectionResponse> getAllConnections(Pageable pageable) {
        return connectionRepository.findAll(pageable).getContent().stream()
                .map(c -> AdminConnectionResponse.builder()
                        .id(c.getId())
                        .userAEmail(c.getUserA().getEmail())
                        .userBEmail(c.getUserB().getEmail())
                        .trustLevel(c.getCurrentTrustLevel().name())
                        .status(c.getStatus().name())
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteConnection(UUID connectionId) {
        trustProgressionLogRepository.deleteByConnectionId(connectionId);
        messageRepository.deleteByConnectionId(connectionId);
        connectionRepository.deleteById(connectionId);
    }

    public List<AdminNeedResponse> getAllNeeds() {
        return getAllNeeds(defaultPage());
    }

    public List<AdminNeedResponse> getAllNeeds(Pageable pageable) {
        return needRepository.findAll(pageable).getContent().stream()
                .map(n -> AdminNeedResponse.builder()
                        .id(n.getId())
                        .elderEmail(n.getElder().getEmail())
                        .category(n.getCategory().name())
                        .status(n.getStatus().name())
                        .createdAt(n.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteNeed(UUID needId) {
        needApplicationRepository.deleteByNeedId(needId);
        needRepository.deleteById(needId);
    }

    public List<AdminMessageResponse> getAllMessages() {
        return getAllMessages(defaultPage());
    }

    public List<AdminMessageResponse> getAllMessages(Pageable pageable) {
        return messageRepository.findAll(pageable).getContent().stream()
                .map(m -> AdminMessageResponse.builder()
                        .id(m.getId())
                        .senderEmail(m.getSender().getEmail())
                        .connectionId(m.getConnection().getId())
                        .content(m.getContent())
                        .createdAt(m.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteMessage(UUID messageId) {
        messageRepository.deleteById(messageId);
    }

    /**
     * Put the demo accounts back to their seeded baseline right now, instead of
     * waiting for the debounced {@code DemoResetCoordinator} reset. Wipes every
     * connection, message, trust log, review and application the demo accounts
     * accumulated (e.g. a Margaret ↔ Harsha link made while recording a video)
     * and re-seeds, recalculating trust scores. No @Transactional here: the
     * seeder runs in its own transaction via TransactionTemplate.
     */
    public void resetDemoData() {
        DemoDataSeeder seeder = demoDataSeeder.getIfAvailable();
        if (seeder == null) {
            throw new IllegalStateException("Demo seeding is disabled on this server (APP_DEMO_SEED_ENABLED=false)");
        }
        if (!seeder.isResetEnabled()) {
            throw new IllegalStateException("Demo reset is disabled on this server (APP_DEMO_RESET_ENABLED=false)");
        }
        seeder.resetDemo();
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
