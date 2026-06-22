package com.towin.account;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Self-service account operations for the authenticated user: GDPR data export
 * (right of access) and account deletion (right to erasure). The cascade purge
 * lives here and is reused by the admin delete path so the two never drift.
 */
@Service
@RequiredArgsConstructor
public class AccountService {

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

    private final com.towin.common.service.S3Service s3Service;

    /**
     * Removes a user and every record that references them. Shared by the
     * self-service delete and the admin delete so both clean up identically.
     */
    @Transactional
    public void purgeUserData(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        String photoUrl = photoUrlFor(userId);
        if (photoUrl != null) s3Service.deleteFile(photoUrl);
        if (user.getIdDocumentUrl() != null) s3Service.deleteFile(user.getIdDocumentUrl());

        messageRepository.deleteByConnectionUserIdOrSenderId(userId);
        reviewRepository.deleteByReviewerIdOrRevieweeId(userId, userId);
        reportRepository.deleteByReporterIdOrReportedUserId(userId, userId);
        needApplicationRepository.deleteByHelperId(userId);
        needRepository.findByElderIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
                .forEach(need -> needApplicationRepository.deleteByNeedId(need.getId()));
        needRepository.deleteByElderId(userId);
        emergencyContactRepository.deleteByElderId(userId);
        trustProgressionLogRepository.deleteByUserId(userId);
        connectionRepository.deleteByUserId(userId);
        elderProfileRepository.deleteByUserId(userId);
        helperProfileRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }

    /** The authenticated user deleting their own account. */
    @Transactional
    public void deleteOwnAccount(UUID userId) {
        purgeUserData(userId);
    }

    /**
     * Builds a plain-data snapshot of everything the platform holds about the
     * user, for a GDPR Article 15 export. Only scalar fields are included so the
     * response serialises cleanly without touching lazy associations.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> exportUserData(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Map<String, Object> out = new LinkedHashMap<>();

        Map<String, Object> account = new LinkedHashMap<>();
        account.put("id", user.getId());
        account.put("username", user.getUsername());
        account.put("email", user.getEmail());
        account.put("phone", user.getPhone());
        account.put("role", user.getRole() != null ? user.getRole().name() : null);
        account.put("authProvider", user.getAuthProvider());
        account.put("trustScore", user.getTrustScore());
        account.put("verificationStatus", user.getVerificationStatus() != null ? user.getVerificationStatus().name() : null);
        account.put("phoneVerified", user.isPhoneVerified());
        account.put("dateOfBirth", user.getDateOfBirth());
        account.put("createdAt", user.getCreatedAt());
        out.put("account", account);

        elderProfileRepository.findByUserId(userId).ifPresent(p -> out.put("elderProfile", elderProfile(p)));
        helperProfileRepository.findByUserId(userId).ifPresent(p -> out.put("helperProfile", helperProfile(p)));

        out.put("needsPosted", needRepository.findByElderIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
                .stream().map(this::needSummary).collect(Collectors.toList()));

        out.put("reviewsGiven", reviewRepository.findByReviewerIdOrderByCreatedAtDesc(userId)
                .stream().map(this::reviewSummary).collect(Collectors.toList()));
        out.put("reviewsReceived", reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)
                .stream().map(this::reviewSummary).collect(Collectors.toList()));

        out.put("emergencyContacts", emergencyContactRepository.findByElderId(userId)
                .stream().map(this::contactSummary).collect(Collectors.toList()));

        out.put("connections", connectionRepository.findAllByUser(userId)
                .stream().map(this::connectionSummary).collect(Collectors.toList()));

        return out;
    }

    private String photoUrlFor(UUID userId) {
        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        if (elder != null && elder.getPhotoUrl() != null) return elder.getPhotoUrl();
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null) return helper.getPhotoUrl();
        return null;
    }

    private Map<String, Object> elderProfile(ElderProfile p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", p.getName());
        m.put("age", p.getAge());
        m.put("bio", p.getBio());
        m.put("interests", p.getInterests());
        m.put("languages", p.getLanguages());
        m.put("occupation", p.getOccupation());
        m.put("gender", p.getGender() != null ? p.getGender().name() : null);
        m.put("facebookUrl", p.getFacebookUrl());
        m.put("instagramUrl", p.getInstagramUrl());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private Map<String, Object> helperProfile(HelperProfile p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", p.getName());
        m.put("age", p.getAge());
        m.put("bio", p.getBio());
        m.put("skillsOffered", p.getSkillsOffered());
        m.put("languages", p.getLanguages());
        m.put("availabilityDays", p.getAvailabilityDays());
        m.put("availabilityTimes", p.getAvailabilityTimes());
        m.put("hobbies", p.getHobbies());
        m.put("occupation", p.getOccupation());
        m.put("gender", p.getGender() != null ? p.getGender().name() : null);
        m.put("facebookUrl", p.getFacebookUrl());
        m.put("instagramUrl", p.getInstagramUrl());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private Map<String, Object> needSummary(Need n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", n.getTitle());
        m.put("category", n.getCategory() != null ? n.getCategory().name() : null);
        m.put("description", n.getDescription());
        m.put("status", n.getStatus() != null ? n.getStatus().name() : null);
        m.put("createdAt", n.getCreatedAt());
        return m;
    }

    private Map<String, Object> reviewSummary(Review r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("rating", r.getRating());
        m.put("tags", r.getTags());
        m.put("comment", r.getComment());
        m.put("createdAt", r.getCreatedAt());
        return m;
    }

    private Map<String, Object> contactSummary(EmergencyContact c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", c.getName());
        m.put("phone", c.getPhone());
        m.put("relationship", c.getRelationship());
        return m;
    }

    private Map<String, Object> connectionSummary(Connection c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("status", c.getStatus() != null ? c.getStatus().name() : null);
        m.put("trustLevel", c.getCurrentTrustLevel() != null ? c.getCurrentTrustLevel().name() : null);
        m.put("createdAt", c.getCreatedAt());
        return m;
    }
}
