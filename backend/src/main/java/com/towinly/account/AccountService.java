package com.towinly.account;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.emergency.entity.EmergencyContact;
import com.towinly.emergency.repository.EmergencyContactRepository;
import com.towinly.family.entity.FamilyAlert;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyAlertRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.messaging.repository.MessageRepository;
import com.towinly.need.entity.Need;
import com.towinly.need.repository.NeedApplicationRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.report.repository.ReportRepository;
import com.towinly.review.entity.Review;
import com.towinly.review.repository.ReviewRepository;
import com.towinly.trust.repository.TrustProgressionLogRepository;
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
    private final FamilyLinkRepository familyLinkRepository;
    private final FamilyAlertRepository familyAlertRepository;
    private final com.towinly.family.repository.FamilyDelegatedPowerRepository familyDelegatedPowerRepository;
    private final com.towinly.family.repository.FamilyPowerRequestRepository familyPowerRequestRepository;

    private final com.towinly.common.service.S3Service s3Service;

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
        familyAlertRepository.deleteByElderId(userId);
        // The DB would cascade these off the user row, but the purge stays the
        // single source of truth for what leaves with an account.
        familyDelegatedPowerRepository.deleteByElderIdOrFamilyUserId(userId, userId);
        familyPowerRequestRepository.deleteByElderIdOrFamilyUserId(userId, userId);
        familyLinkRepository.deleteByElderIdOrFamilyUserId(userId, userId);
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

        out.put("familyLinks", familyLinkRepository.findByElderIdOrFamilyUserId(userId, userId)
                .stream().map(this::familyLinkSummary).collect(Collectors.toList()));

        // Elder-keyed: non-elders simply get an empty list here.
        out.put("familyAlerts", familyAlertRepository.findByElderIdOrderByCreatedAtDesc(userId)
                .stream().map(this::familyAlertSummary).collect(Collectors.toList()));

        // Personal data on both seats: what an elder handed out, and what a
        // family member holds or asked for.
        out.put("delegatedPowers", familyDelegatedPowerRepository.findByElderIdOrFamilyUserId(userId, userId)
                .stream().map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("power", p.getPower() != null ? p.getPower().name() : null);
                    m.put("elderId", p.getElder().getId());
                    m.put("familyUserId", p.getFamilyUser().getId());
                    m.put("createdAt", p.getCreatedAt());
                    return m;
                }).collect(Collectors.toList()));
        out.put("powerRequests", familyPowerRequestRepository.findByElderIdOrFamilyUserId(userId, userId)
                .stream().map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("power", r.getPower() != null ? r.getPower().name() : null);
                    m.put("status", r.getStatus() != null ? r.getStatus().name() : null);
                    m.put("elderId", r.getElder().getId());
                    m.put("familyUserId", r.getFamilyUser().getId());
                    m.put("createdAt", r.getCreatedAt());
                    m.put("respondedAt", r.getRespondedAt());
                    return m;
                }).collect(Collectors.toList()));

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

    private Map<String, Object> familyLinkSummary(FamilyLink l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("elderId", l.getElder() != null ? l.getElder().getId() : null);
        m.put("familyUserId", l.getFamilyUser() != null ? l.getFamilyUser().getId() : null);
        m.put("initiatedById", l.getInitiatedBy() != null ? l.getInitiatedBy().getId() : null);
        m.put("relationship", l.getRelationship());
        m.put("status", l.getStatus() != null ? l.getStatus().name() : null);
        m.put("isPrimary", l.getIsPrimary());
        m.put("createdAt", l.getCreatedAt());
        m.put("respondedAt", l.getRespondedAt());
        m.put("revokedAt", l.getRevokedAt());
        return m;
    }

    private Map<String, Object> familyAlertSummary(FamilyAlert a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", a.getType());
        m.put("body", a.getBody());
        m.put("createdAt", a.getCreatedAt());
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
