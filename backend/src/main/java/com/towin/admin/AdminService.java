package com.towin.admin;

import com.towin.admin.dto.*;
import com.towin.common.entity.User;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.repository.EmergencyContactRepository;
import com.towin.messaging.repository.MessageRepository;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.repository.TrustProgressionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ReportRepository reportRepository;
    private final ConnectionRepository connectionRepository;
    private final NeedRepository needRepository;
    private final NeedApplicationRepository needApplicationRepository;
    private final MessageRepository messageRepository;
    private final EmergencyContactRepository emergencyContactRepository;
    private final TrustProgressionLogRepository trustProgressionLogRepository;
    private final S3Service s3Service;
    private final TrustScoreService trustScoreService;

    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(u -> AdminUserResponse.builder()
                        .id(u.getId())
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
        if (elder != null) return elder.getPhotoUrl();
        var helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null) return helper.getPhotoUrl();
        return null;
    }

    @Transactional
    public void suspendUser(UUID userId) {
        User user = getUser(userId);
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

        String photoUrl = getPhotoUrl(userId);
        if (photoUrl != null) s3Service.deleteFile(photoUrl);
        if (user.getIdDocumentUrl() != null) s3Service.deleteFile(user.getIdDocumentUrl());

        // Delete messages involving this user's connections or sent by this user
        messageRepository.deleteByConnectionUserIdOrSenderId(userId);
        // Delete reviews and reports referencing this user
        reviewRepository.deleteByReviewerIdOrRevieweeId(userId, userId);
        reportRepository.deleteByReporterIdOrReportedUserId(userId, userId);
        // Delete need applications this user submitted as a helper
        needApplicationRepository.deleteByHelperId(userId);
        // Delete applications on needs posted by this elder (from other helpers), then delete the needs
        needRepository.findByElderIdOrderByCreatedAtDesc(userId, org.springframework.data.domain.Pageable.unpaged())
                .forEach(need -> needApplicationRepository.deleteByNeedId(need.getId()));
        needRepository.deleteByElderId(userId);
        // Delete emergency contacts, trust logs, connections, profiles
        emergencyContactRepository.deleteByElderId(userId);
        trustProgressionLogRepository.deleteByUserId(userId);
        connectionRepository.deleteByUserId(userId);
        elderProfileRepository.deleteByUserId(userId);
        helperProfileRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }

    public List<AdminVerificationResponse> getPendingVerifications() {
        return userRepository.findByVerificationStatus(VerificationStatus.PENDING)
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
        return reportRepository.findAllWithUsers().stream()
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
        var reviews = safetyConcernOnly
                ? reviewRepository.findBySafetyConcernTrue()
                : reviewRepository.findAll();
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
        return connectionRepository.findAll().stream()
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
        return needRepository.findAll().stream()
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
        return messageRepository.findAll().stream()
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

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
