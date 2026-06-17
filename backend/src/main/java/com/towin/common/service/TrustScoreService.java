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
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import com.towin.trust.dto.TrustScoreBreakdownResponse.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Trust score v3 — per-customer model.
 *
 * Every active customer relationship is worth up to 15 whole points:
 *   • Rooting  0–7  — one point per trust stage reached with that customer.
 *   • Review   0–5  — one point per star the customer gives you (latest review).
 *   • Profile  0–3  — your profile completeness, counted for every customer.
 *
 * Total trust score = the sum across all customers.
 */
@Service
@RequiredArgsConstructor
public class TrustScoreService {

    public static final int ROOTING_MAX  = 7;
    public static final int REVIEW_MAX   = 5;
    public static final int PROFILE_MAX  = 3;
    public static final int CUSTOMER_MAX = ROOTING_MAX + REVIEW_MAX + PROFILE_MAX; // 15

    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ConnectionRepository connectionRepository;

    @Transactional
    public void recalculate(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        int profilePoints = calculateProfilePoints(user);
        Map<UUID, Integer> reviewByCustomer = latestRatingByReviewer(userId);

        int total = 0;
        for (Connection c : connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)) {
            UUID customerId = c.getOtherUser(userId).getId();
            int rooting = rootingPoints(c.getCurrentTrustLevel());
            int review  = Math.min(reviewByCustomer.getOrDefault(customerId, 0), REVIEW_MAX);
            total += rooting + review + profilePoints;
        }

        user.setTrustScore((double) total);
        userRepository.save(user);
    }

    public TrustScoreBreakdownResponse getMyScoreBreakdown(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        int profilePoints = calculateProfilePoints(user);
        Map<UUID, Integer> reviewByCustomer = latestRatingByReviewer(userId);

        List<CustomerCard> cards = new ArrayList<>();
        int total = 0;

        for (Connection c : connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)) {
            User customer = c.getOtherUser(userId);
            int rooting = rootingPoints(c.getCurrentTrustLevel());
            int review  = Math.min(reviewByCustomer.getOrDefault(customer.getId(), 0), REVIEW_MAX);
            int cardTotal = rooting + review + profilePoints;
            total += cardTotal;

            cards.add(CustomerCard.builder()
                    .connectionId(c.getId())
                    .customerName(displayName(customer))
                    .customerPhotoUrl(photoUrl(customer))
                    .currentStageLabel(stageLabel(c.getCurrentTrustLevel()))
                    .stageIndex(c.getCurrentTrustLevel().getValue())
                    .rooting(rooting).rootingMax(ROOTING_MAX)
                    .review(review).reviewMax(REVIEW_MAX).hasReview(review > 0)
                    .profile(profilePoints).profileMax(PROFILE_MAX)
                    .total(cardTotal).totalMax(CUSTOMER_MAX)
                    .build());
        }

        // Most points first — completed customers float to the top.
        cards.sort((a, b) -> Integer.compare(b.getTotal(), a.getTotal()));

        return TrustScoreBreakdownResponse.builder()
                .totalScore((double) total)
                .tier(tierFor(total))
                .maxPerCustomer(CUSTOMER_MAX)
                .profile(ProfileSection.builder()
                        .earned(profilePoints)
                        .max(PROFILE_MAX)
                        .tasks(buildProfileTasks(user))
                        .build())
                .customers(cards)
                .build();
    }

    // ── Scoring helpers ──────────────────────────────────────────────────────

    /** One point per trust stage reached: DISCOVERED=1 … TRUSTED=7. */
    private int rootingPoints(TrustLevel level) {
        return Math.min(level.getValue() + 1, ROOTING_MAX);
    }

    /** Profile = 3 simple milestones, 1 point each. */
    private int calculateProfilePoints(User user) {
        HelperProfile p = helperProfileRepository.findByUserId(user.getId()).orElse(null);
        ElderProfile  e = elderProfileRepository.findByUserId(user.getId()).orElse(null);
        int pts = 0;
        if (hasPhoto(p, e)) pts++;
        if (hasBio(p, e))   pts++;
        if (isVerified(user)) pts++;
        return pts;
    }

    /** Newest review rating per reviewer (the customer's latest word on you). */
    private Map<UUID, Integer> latestRatingByReviewer(UUID userId) {
        Map<UUID, Integer> map = new HashMap<>();
        for (Review r : reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)) {
            map.putIfAbsent(r.getReviewer().getId(), r.getRating()); // first = newest
        }
        return map;
    }

    private List<ProfileTask> buildProfileTasks(User user) {
        HelperProfile p = helperProfileRepository.findByUserId(user.getId()).orElse(null);
        ElderProfile  e = elderProfileRepository.findByUserId(user.getId()).orElse(null);

        List<ProfileTask> tasks = new ArrayList<>();
        tasks.add(task("photo", "Add a profile photo", hasPhoto(p, e),
                "A clear photo helps people feel comfortable with you."));
        tasks.add(task("bio", "Write a short bio", hasBio(p, e),
                "A few words about yourself goes a long way."));
        tasks.add(task("verified", "Verify yourself", isVerified(user),
                "Verify your phone or your ID in Profile."));
        return tasks;
    }

    private ProfileTask task(String key, String label, boolean completed, String tip) {
        return ProfileTask.builder()
                .key(key).label(label).completed(completed)
                .tip(completed ? null : tip)
                .build();
    }

    private boolean hasPhoto(HelperProfile p, ElderProfile e) {
        return (p != null && notBlank(p.getPhotoUrl())) || (e != null && notBlank(e.getPhotoUrl()));
    }

    private boolean hasBio(HelperProfile p, ElderProfile e) {
        return (p != null && notBlank(p.getBio())) || (e != null && notBlank(e.getBio()));
    }

    private boolean isVerified(User user) {
        return user.isPhoneVerified() || user.getVerificationStatus() == VerificationStatus.VERIFIED;
    }

    // ── Display helpers ──────────────────────────────────────────────────────

    private String stageLabel(TrustLevel level) {
        switch (level) {
            case MESSAGING:  return "Messaging";
            case PHONE_CALL: return "Phone Ready";
            case VIDEO_CALL: return "Video Ready";
            case VERIFIED:   return "Verified";
            case FIRST_MEET: return "Ready to Meet";
            case TRUSTED:    return "Fully Trusted";
            case DISCOVERED:
            default:         return "Connected";
        }
    }

    private String displayName(User user) {
        return elderProfileRepository.findByUserId(user.getId()).map(ElderProfile::getName)
                .or(() -> helperProfileRepository.findByUserId(user.getId()).map(HelperProfile::getName))
                .filter(this::notBlank)
                .orElseGet(() -> user.getFullName() != null ? user.getFullName() : "A member");
    }

    private String photoUrl(User user) {
        return elderProfileRepository.findByUserId(user.getId()).map(ElderProfile::getPhotoUrl)
                .or(() -> helperProfileRepository.findByUserId(user.getId()).map(HelperProfile::getPhotoUrl))
                .filter(this::notBlank)
                .orElse(null);
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    public static String tierFor(int score) {
        if (score >= 90) return "Community Champion";
        if (score >= 45) return "Highly Trusted";
        if (score >= 15) return "Reliable";
        if (score >= 1)  return "Getting Started";
        return "New Member";
    }
}
