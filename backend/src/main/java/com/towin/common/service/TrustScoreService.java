package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.repository.FamilyLinkRepository;
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
 *   • Helpers/BOTH/FAMILY: Profile 0–3 (three groups), counted for every customer.
 *   • Elders: Profile 0–2 (two groups) + Family 0–1 (flat point once any family
 *     member is linked), both counted for every customer.
 *
 * Total trust score = the sum across all customers.
 */
@Service
@RequiredArgsConstructor
public class TrustScoreService {

    public static final int ROOTING_MAX  = 7;
    public static final int REVIEW_MAX   = 5;
    /** Helpers, BOTH and FAMILY roles keep the original three profile groups. */
    public static final int PROFILE_MAX  = 3;
    /** Elders: profile shrinks to two groups; family connected is the third point. */
    public static final int PROFILE_MAX_ELDER = 2;
    /** Elders: one flat point once any family member is linked — never more. */
    public static final int FAMILY_POINT = 1;
    public static final int CUSTOMER_MAX = ROOTING_MAX + REVIEW_MAX + PROFILE_MAX; // 15 both ways

    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ConnectionRepository connectionRepository;
    private final S3Service s3Service;
    private final FamilyLinkRepository familyLinkRepository;

    @Transactional
    public void recalculate(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        int profilePoints = calculateProfilePoints(user);
        int familyPoints  = familyPoints(user);
        Map<UUID, Integer> reviewByCustomer = latestRatingByReviewer(userId);

        // Profile + family always count once so new users get immediate feedback.
        int total = profilePoints + familyPoints;
        for (Connection c : connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)) {
            UUID customerId = c.getOtherUser(userId).getId();
            int rooting = rootingPoints(c.getCurrentTrustLevel());
            int review  = Math.min(reviewByCustomer.getOrDefault(customerId, 0), REVIEW_MAX);
            total += rooting + review + profilePoints + familyPoints;
        }

        user.setTrustScore((double) total);
        userRepository.save(user);
    }

    public TrustScoreBreakdownResponse getMyScoreBreakdown(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        List<ProfileGroup> profileGroups = buildProfileGroups(user);
        int profilePoints = completedGroups(profileGroups);
        Map<UUID, Integer> reviewByCustomer = latestRatingByReviewer(userId);

        int familyPoints = familyPoints(user);
        int profileMax   = profileMaxFor(user);
        boolean isElder  = user.getRole() == UserRole.ELDER;

        List<CustomerCard> cards = new ArrayList<>();
        int total = profilePoints + familyPoints;

        for (Connection c : connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)) {
            User customer = c.getOtherUser(userId);
            int rooting = rootingPoints(c.getCurrentTrustLevel());
            int review  = Math.min(reviewByCustomer.getOrDefault(customer.getId(), 0), REVIEW_MAX);
            int cardTotal = rooting + review + profilePoints + familyPoints;
            total += cardTotal;

            cards.add(CustomerCard.builder()
                    .connectionId(c.getId())
                    .customerName(displayName(customer))
                    .customerPhotoUrl(photoUrl(customer))
                    .currentStageLabel(stageLabel(c.getCurrentTrustLevel()))
                    .stageIndex(c.getCurrentTrustLevel().getValue())
                    .rooting(rooting).rootingMax(ROOTING_MAX)
                    .review(review).reviewMax(REVIEW_MAX).hasReview(review > 0)
                    .profile(profilePoints).profileMax(profileMax)
                    .family(familyPoints).familyMax(isElder ? FAMILY_POINT : 0)
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
                        .max(profileMax)
                        .groups(profileGroups)
                        .build())
                .family(isElder
                        ? FamilySection.builder().earned(familyPoints).max(FAMILY_POINT).build()
                        : null)
                .customers(cards)
                .build();
    }

    // ── Scoring helpers ──────────────────────────────────────────────────────

    /**
     * Family connected — one flat point, role ELDER only (user decision
     * 2026-07-18): 1 point whether one or five family members are linked, and
     * it repeats in every customer block exactly like profile points do.
     * HELPER, BOTH and FAMILY roles earn 0 from family; PENDING links count 0.
     * Points don't depend on the share switch — linking earns the point,
     * sharing is a separate private choice.
     */
    private int familyPoints(User user) {
        if (user.getRole() != UserRole.ELDER) return 0;
        long active = familyLinkRepository.countByElderIdAndStatusIn(
                user.getId(), List.of(FamilyLinkStatus.ACTIVE));
        return active > 0 ? FAMILY_POINT : 0;
    }

    private int profileMaxFor(User user) {
        return user.getRole() == UserRole.ELDER ? PROFILE_MAX_ELDER : PROFILE_MAX;
    }

    /** One point per trust stage reached: DISCOVERED=1 … TRUSTED=7. */
    private int rootingPoints(TrustLevel level) {
        return Math.min(level.getValue() + 1, ROOTING_MAX);
    }

    /** Profile groups (3 by default, 2 for elders); each fully-filled group is 1 point. */
    private int calculateProfilePoints(User user) {
        return completedGroups(buildProfileGroups(user));
    }

    private int completedGroups(List<ProfileGroup> groups) {
        return (int) groups.stream().filter(ProfileGroup::isCompleted).count();
    }

    /** Newest review rating per reviewer (the customer's latest word on you). */
    private Map<UUID, Integer> latestRatingByReviewer(UUID userId) {
        Map<UUID, Integer> map = new HashMap<>();
        for (Review r : reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)) {
            map.putIfAbsent(r.getReviewer().getId(), r.getRating()); // first = newest
        }
        return map;
    }

    /**
     * Splits the full profile into 3 groups, each worth 1 point. A group only
     * scores when every field in it is filled — so points stay whole numbers.
     */
    private List<ProfileGroup> buildProfileGroups(User user) {
        HelperProfile p = helperProfileRepository.findByUserId(user.getId()).orElse(null);
        ElderProfile  e = elderProfileRepository.findByUserId(user.getId()).orElse(null);

        boolean photo = (p != null && notBlank(p.getPhotoUrl())) || (e != null && notBlank(e.getPhotoUrl()));
        boolean bio   = (p != null && notBlank(p.getBio()))      || (e != null && notBlank(e.getBio()));
        boolean dob   = (p != null && p.getDateOfBirth() != null) || (e != null && user.getDateOfBirth() != null);
        boolean occupation = (p != null && notBlank(p.getOccupation())) || (e != null && notBlank(e.getOccupation()));
        boolean interests  = (p != null && hasItems(p.getHobbies()))    || (e != null && hasItems(e.getInterests()));
        boolean social = (p != null && (notBlank(p.getFacebookUrl()) || notBlank(p.getInstagramUrl())))
                      || (e != null && (notBlank(e.getFacebookUrl()) || notBlank(e.getInstagramUrl())));
        boolean phoneVerified = user.isPhoneVerified();
        boolean idVerified    = user.getVerificationStatus() == VerificationStatus.VERIFIED;

        String interestsLabel = (p != null) ? "Your hobbies" : "Your interests";

        List<ProfileItem> verifyItems = List.of(
                item("phone", "Phone verified", phoneVerified, "Verify your phone number in Profile."),
                item("id",    "ID verified",    idVerified,    "Upload a government ID in Profile → Verification."));

        List<ProfileGroup> groups = new ArrayList<>();
        if (user.getRole() == UserRole.ELDER) {
            // Elders (user decision 2026-07-18): two groups — everything about
            // you in one, verification in the other. Family connected is the
            // elder's third point, earned on the family page instead.
            groups.add(group("about", "About you", List.of(
                    item("photo", "Profile photo", photo, "Add a clear photo of yourself."),
                    item("bio",   "Short bio",     bio,   "Write a few lines about yourself."),
                    item("dob",   "Date of birth", dob,   "Add your date of birth."),
                    item("occupation", "Occupation",   occupation, "Add what you do — it helps others feel comfortable."),
                    item("interests",  interestsLabel, interests,  "Add at least one. Shared interests start friendships."),
                    item("social",     "Social link",  social,     "Link your Facebook or Instagram.")
            )));
            groups.add(group("verify", "Verify yourself", verifyItems));
            return groups;
        }
        groups.add(group("introduce", "Introduce yourself", List.of(
                item("photo", "Profile photo", photo, "Add a clear photo of yourself."),
                item("bio",   "Short bio",     bio,   "Write a few lines about yourself."),
                item("dob",   "Date of birth", dob,   "Add your date of birth.")
        )));
        groups.add(group("about", "Share more about you", List.of(
                item("occupation", "Occupation",     occupation, "Add what you do — it helps others feel comfortable."),
                item("interests",  interestsLabel,   interests,  "Add at least one. Shared interests start friendships."),
                item("social",     "Social link",    social,     "Link your Facebook or Instagram.")
        )));
        groups.add(group("verify", "Verify yourself", verifyItems));
        return groups;
    }

    private ProfileGroup group(String key, String label, List<ProfileItem> items) {
        int done = (int) items.stream().filter(ProfileItem::isCompleted).count();
        return ProfileGroup.builder()
                .key(key).label(label).items(items)
                .doneCount(done).itemCount(items.size())
                .completed(done == items.size())
                .build();
    }

    private ProfileItem item(String key, String label, boolean completed, String tip) {
        return ProfileItem.builder()
                .key(key).label(label).completed(completed)
                .tip(completed ? null : tip)
                .build();
    }

    private boolean hasItems(String[] arr) { return arr != null && arr.length > 0; }

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
                .map(s3Service::presignedUrl)
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
