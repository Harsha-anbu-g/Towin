package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import com.towin.trust.dto.TrustScoreBreakdownResponse.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrustScoreService {

    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ConnectionRepository connectionRepository;

    @Transactional
    public void recalculate(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        HelperProfile profile = helperProfileRepository.findByUserId(userId).orElse(null);
        ElderProfile elderProfile = elderProfileRepository.findByUserId(userId).orElse(null);

        double basic  = calculateBasicScore(user, profile, elderProfile);
        int rooting   = calculateRootingScore(userId);
        int review    = reviewRepository.sumRatingsByRevieweeId(userId);

        user.setTrustScore((int) Math.round(basic + rooting + review));
        userRepository.save(user);
    }

    public TrustScoreBreakdownResponse getMyScoreBreakdown(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        HelperProfile profile = helperProfileRepository.findByUserId(userId).orElse(null);
        ElderProfile elderProfile = elderProfileRepository.findByUserId(userId).orElse(null);

        double basic = calculateBasicScore(user, profile, elderProfile);

        List<Connection> active = connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE);
        int rootingScore = active.stream().mapToInt(c -> stagesEarned(c.getCurrentTrustLevel())).sum();

        int reviewScore = reviewRepository.sumRatingsByRevieweeId(userId);
        int reviewCount = reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId).size();

        double total = basic + rootingScore + reviewScore;

        return TrustScoreBreakdownResponse.builder()
                .totalScore(total)
                .tier(tierFor((int) Math.round(total)))
                .basic(BasicSection.builder()
                        .earned(basic)
                        .max(2.0)
                        .fields(buildProfileFields(user, profile, elderProfile))
                        .build())
                .rooting(RootingSection.builder()
                        .earned(rootingScore)
                        .relationshipCount(active.size())
                        .detail(active.size() + " active " + (active.size() == 1 ? "relationship" : "relationships")
                                + " · " + rootingScore + " stage " + (rootingScore == 1 ? "point" : "points") + " earned")
                        .build())
                .review(ReviewSection.builder()
                        .earned(reviewScore)
                        .reviewCount(reviewCount)
                        .detail(reviewCount + (reviewCount == 1 ? " review" : " reviews")
                                + " · " + reviewScore + " total " + (reviewScore == 1 ? "star" : "stars"))
                        .build())
                .build();
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private double calculateBasicScore(User user, HelperProfile p, ElderProfile e) {
        double score = 0.0;
        if (user.getVerificationStatus() == VerificationStatus.VERIFIED) score += 0.25;
        if (user.isPhoneVerified())                                        score += 0.25;

        if (p != null) {
            if (notBlank(p.getPhotoUrl()))                                     score += 0.25;
            if (notBlank(p.getFacebookUrl()) || notBlank(p.getInstagramUrl())) score += 0.25;
            if (p.getHobbies() != null && p.getHobbies().length > 0)          score += 0.25;
            if (notBlank(p.getOccupation()))                                   score += 0.25;
            if (notBlank(p.getBio()))                                          score += 0.25;
            if (p.getDateOfBirth() != null)                                    score += 0.25;
        }

        if (e != null) {
            if (notBlank(e.getPhotoUrl()))                                     score += 0.25;
            if (notBlank(e.getFacebookUrl()) || notBlank(e.getInstagramUrl())) score += 0.25;
            if (notBlank(e.getOccupation()))                                   score += 0.25;
            if (notBlank(e.getBio()))                                          score += 0.25;
            if (user.getDateOfBirth() != null)                                 score += 0.25;
        }

        return Math.min(score, 2.0);
    }

    private int calculateRootingScore(UUID userId) {
        return connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)
                .stream().mapToInt(c -> stagesEarned(c.getCurrentTrustLevel())).sum();
    }

    private int stagesEarned(TrustLevel level) {
        int v = level.getValue();
        int pts = 0;
        if (v >= TrustLevel.MESSAGING.getValue())  pts++; // Stage 1: text
        if (v >= TrustLevel.PHONE_CALL.getValue()) pts++; // Stage 2: voice
        if (v >= TrustLevel.VIDEO_CALL.getValue()) pts++; // Stage 3: video
        if (v >= TrustLevel.FIRST_MEET.getValue()) pts++; // Stage 4: in-person (VERIFIED=4 < FIRST_MEET=5, skipped)
        if (v >= TrustLevel.TRUSTED.getValue())    pts++; // Stage 5: help session
        return pts;
    }

    private List<ProfileField> buildProfileFields(User user, HelperProfile p, ElderProfile e) {
        List<ProfileField> fields = new ArrayList<>();
        fields.add(field("id_verified", "Identity Verified",
                user.getVerificationStatus() == VerificationStatus.VERIFIED,
                "Upload a government ID in Profile → Verification."));
        fields.add(field("phone_verified", "Phone Verified",
                user.isPhoneVerified(),
                "Verify your phone number in Profile → Verification."));

        if (p != null) {
            fields.add(field("photo",      "Profile Photo",
                    notBlank(p.getPhotoUrl()),
                    "Add a clear photo so elders feel comfortable."));
            fields.add(field("social",     "Social Media",
                    notBlank(p.getFacebookUrl()) || notBlank(p.getInstagramUrl()),
                    "Link your Facebook or Instagram in your profile."));
            fields.add(field("hobbies",    "Hobbies",
                    p.getHobbies() != null && p.getHobbies().length > 0,
                    "Add at least one hobby — shared interests start friendships."));
            fields.add(field("occupation", "Occupation",
                    notBlank(p.getOccupation()),
                    "Add your occupation — context builds trust."));
            fields.add(field("bio",        "About Me",
                    notBlank(p.getBio()),
                    "Write a short bio in your own words."));
            fields.add(field("dob",        "Date of Birth",
                    p.getDateOfBirth() != null,
                    "Add your date of birth in your profile."));
        }

        if (e != null) {
            fields.add(field("photo",      "Profile Photo",
                    notBlank(e.getPhotoUrl()),
                    "Add a clear photo so others feel comfortable."));
            fields.add(field("social",     "Social Media",
                    notBlank(e.getFacebookUrl()) || notBlank(e.getInstagramUrl()),
                    "Link your Facebook or Instagram in your profile."));
            fields.add(field("occupation", "Occupation",
                    notBlank(e.getOccupation()),
                    "Add your occupation — context builds trust."));
            fields.add(field("bio",        "About Me",
                    notBlank(e.getBio()),
                    "Write a short bio in your own words."));
            fields.add(field("dob",        "Date of Birth",
                    user.getDateOfBirth() != null,
                    "Add your date of birth in your profile."));
        }

        return fields;
    }

    private ProfileField field(String key, String label, boolean completed, String tip) {
        return ProfileField.builder()
                .key(key).label(label).completed(completed)
                .tip(completed ? null : tip)
                .build();
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    public static String tierFor(int score) {
        if (score >= 120) return "Community Champion";
        if (score >= 50)  return "Highly Trusted";
        if (score >= 15)  return "Reliable";
        if (score >= 3)   return "Getting Started";
        return "New Member";
    }
}
