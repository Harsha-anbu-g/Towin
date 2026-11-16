package com.towinly.trust.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.TrustLevel;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.TrustScoreService;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.profile.entity.HelperProfile;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.review.entity.Review;
import com.towinly.review.repository.ReviewRepository;
import com.towinly.trust.dto.TrustScoreBreakdownResponse;
import com.towinly.trust.dto.TrustScoreBreakdownResponse.CustomerCard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class TrustScoreServiceTest {

    @Mock UserRepository userRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock com.towinly.common.service.S3Service s3Service;
    @Mock com.towinly.family.repository.FamilyLinkRepository familyLinkRepository;

    @InjectMocks TrustScoreService trustScoreService;

    UUID userId = UUID.randomUUID();
    User baseUser;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        // HELPER pins the default 3-group scheme (builder would default role to
        // ELDER, whose profile shrank to 2 groups + family point on 2026-07-18).
        baseUser = User.builder()
                .id(userId)
                .email("t@t.com").phone("123").passwordHash("x")
                .phoneVerified(false)
                .verificationStatus(VerificationStatus.NONE)
                .role(UserRole.HELPER)
                .trustScore(0.0)
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
    }

    private void connections(Connection... cs) {
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(cs));
    }

    private void reviews(Review... rs) {
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(rs));
    }

    private User customer() {
        return User.builder().id(UUID.randomUUID()).build();
    }

    /** A pair whose help was ended at this step: the step is banked, so it counts. */
    private Connection connection(User customer, TrustLevel level) {
        return Connection.builder().userA(baseUser).userB(customer)
                .currentTrustLevel(level).bankedTrustLevel(level).build();
    }

    /** A pair on the ladder with no finished help yet: nothing is banked. */
    private Connection unfinished(User customer, TrustLevel level) {
        return Connection.builder().userA(baseUser).userB(customer).currentTrustLevel(level).build();
    }

    /** Completes the "Introduce yourself" group (photo + bio + date of birth). */
    private HelperProfile introduceGroupFilled() {
        return HelperProfile.builder()
                .photoUrl("https://photo.jpg")
                .bio("Hello, I love helping out.")
                .dateOfBirth(java.time.LocalDate.of(1960, 1, 1))
                .build();
    }

    /** Fills every profile field across all three groups. */
    private HelperProfile fullProfile() {
        return HelperProfile.builder()
                .photoUrl("https://photo.jpg")
                .bio("Hello, I love helping out.")
                .dateOfBirth(java.time.LocalDate.of(1960, 1, 1))
                .occupation("Teacher")
                .hobbies(new String[]{"reading"})
                .facebookUrl("https://facebook.com/me")
                .build();
    }

    private void makeFullyVerified() {
        baseUser.setPhoneVerified(true);
        baseUser.setVerificationStatus(VerificationStatus.VERIFIED);
    }

    // ── Profile (0–3, three milestones) ──────────────────────────────────────

    @Test
    void profile_isZero_whenNothingFilled() {
        connections();
        reviews();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getProfile().getEarned()).isEqualTo(0);
        assertThat(r.getProfile().getMax()).isEqualTo(3);
        assertThat(r.getTotalScore()).isEqualTo(0.0);
        assertThat(r.getCustomers()).isEmpty();
    }

    @Test
    void profile_isOne_whenOnlyOneGroupComplete() {
        // Photo + bio + DOB completes the "Introduce yourself" group only.
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(introduceGroupFilled()));
        connections();
        reviews();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getProfile().getEarned()).isEqualTo(1);
        assertThat(r.getProfile().getGroups()).hasSize(3);
        assertThat(r.getProfile().getGroups().get(0).isCompleted()).isTrue();
        assertThat(r.getProfile().getGroups().get(0).getDoneCount()).isEqualTo(3);
        assertThat(r.getProfile().getGroups().get(1).isCompleted()).isFalse();
    }

    @Test
    void profile_isThree_whenEveryGroupComplete() {
        makeFullyVerified();
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(fullProfile()));
        connections();
        reviews();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getProfile().getEarned()).isEqualTo(3);
    }

    // ── Rooting (one point per stage, 1–7) ───────────────────────────────────

    @Test
    void rooting_isOne_atDiscovered() {
        connections(connection(customer(), TrustLevel.DISCOVERED));
        reviews();

        CustomerCard card = trustScoreService.getMyScoreBreakdown(userId).getCustomers().get(0);

        assertThat(card.getRooting()).isEqualTo(1);
        assertThat(card.getStageIndex()).isEqualTo(0);
        assertThat(card.getCurrentStageLabel()).isEqualTo("Connected");
    }

    @Test
    void chatOnlyFriendsEarnNoPoints() {
        Connection peer = connection(customer(), TrustLevel.TRUSTED);
        peer.setType(com.towinly.common.enums.ConnectionType.PEER);
        connections(peer);
        reviews();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getCustomers()).isEmpty();
        assertThat(r.getTotalScore()).isEqualTo(0.0);
    }

    @Test
    void rooting_isSeven_atTrusted() {
        connections(connection(customer(), TrustLevel.TRUSTED));
        reviews();

        CustomerCard card = trustScoreService.getMyScoreBreakdown(userId).getCustomers().get(0);

        assertThat(card.getRooting()).isEqualTo(7);
        assertThat(card.getCurrentStageLabel()).isEqualTo("Fully Trusted");
    }

    @Test
    void rooting_isFive_atVerified() {
        connections(connection(customer(), TrustLevel.VERIFIED));
        reviews();

        CustomerCard card = trustScoreService.getMyScoreBreakdown(userId).getCustomers().get(0);

        assertThat(card.getRooting()).isEqualTo(5);
    }

    // ── Review (one point per star from that customer, max 5) ─────────────────

    @Test
    void review_countsThatCustomersLatestRating() {
        User cust = customer();
        Review fiveStar = Review.builder().reviewer(cust).reviewee(baseUser).rating(5).build();
        connections(connection(cust, TrustLevel.DISCOVERED));
        reviews(fiveStar);

        CustomerCard card = trustScoreService.getMyScoreBreakdown(userId).getCustomers().get(0);

        assertThat(card.getReview()).isEqualTo(5);
        assertThat(card.isHasReview()).isTrue();
        // rooting 1 + review 5 + profile 0
        assertThat(card.getTotal()).isEqualTo(6);
    }

    // ── Total = sum across customers, with profile counted per customer ───────

    @Test
    void total_sumsAcrossCustomers_includingProfilePerCustomer() {
        makeFullyVerified();
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(fullProfile()));

        // profile points = 3 each
        connections(
                connection(customer(), TrustLevel.MESSAGING),   // rooting 2 + 0 + 3 = 5
                connection(customer(), TrustLevel.PHONE_CALL));  // rooting 3 + 0 + 3 = 6
        reviews();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        // profile counts once standalone (3) + per customer: 3 + 5 + 6
        assertThat(r.getTotalScore()).isEqualTo(14.0);
        assertThat(r.getCustomers()).hasSize(2);
        assertThat(r.getMaxPerCustomer()).isEqualTo(15);
        // highest-total customer first
        assertThat(r.getCustomers().get(0).getTotal()).isEqualTo(6);
    }

    @Test
    void recalculate_storesIntegerTotalOnUser() {
        connections(connection(customer(), TrustLevel.TRUSTED)); // rooting 7, no review, no profile
        reviews();

        trustScoreService.recalculate(userId);

        assertThat(baseUser.getTrustScore()).isEqualTo(7.0);
    }

    // ── A friendship counts only once a help between the two is finished ─────

    @Test
    void friendshipWithNoFinishedHelp_addsNothing() {
        makeFullyVerified();
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(fullProfile()));
        User cust = customer();
        Review fiveStar = Review.builder().reviewer(cust).reviewee(baseUser).rating(5).build();
        connections(unfinished(cust, TrustLevel.TRUSTED));
        reviews(fiveStar);

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        // Own profile counts once (3); the friendship itself adds nothing yet.
        assertThat(r.getTotalScore()).isEqualTo(3.0);
        CustomerCard card = r.getCustomers().get(0);
        assertThat(card.isCounted()).isFalse();
        assertThat(card.getRooting()).isEqualTo(0);
        assertThat(card.getReview()).isEqualTo(0);
        assertThat(card.getProfile()).isEqualTo(0);
        assertThat(card.getTotal()).isEqualTo(0);
        // The ladder still shows where the pair really is.
        assertThat(card.getStageIndex()).isEqualTo(6);
    }

    @Test
    void ladderPoints_comeFromTheBankedStep_notTheLiveStep() {
        Connection c = unfinished(customer(), TrustLevel.TRUSTED);
        c.setBankedTrustLevel(TrustLevel.VIDEO_CALL);
        connections(c);
        reviews();

        CustomerCard card = trustScoreService.getMyScoreBreakdown(userId).getCustomers().get(0);

        assertThat(card.isCounted()).isTrue();
        assertThat(card.getRooting()).isEqualTo(4);
        assertThat(card.getStageIndex()).isEqualTo(6);
    }

    @Test
    void bankedStepAboveTheLiveStep_countsNothing() {
        // Steps only move up, so this can only mean the ladder was restarted after
        // the step was banked. A restart must not leave the old points standing.
        makeFullyVerified();
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(fullProfile()));
        Connection restarted = unfinished(customer(), TrustLevel.DISCOVERED);
        restarted.setBankedTrustLevel(TrustLevel.TRUSTED);
        connections(restarted);
        reviews();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);
        trustScoreService.recalculate(userId);

        assertThat(r.getCustomers().get(0).isCounted()).isFalse();
        assertThat(r.getTotalScore()).isEqualTo(3.0);       // own profile only
        assertThat(baseUser.getTrustScore()).isEqualTo(3.0);
    }

    @Test
    void recalculate_ignoresFriendshipsWithNoFinishedHelp() {
        connections(unfinished(customer(), TrustLevel.TRUSTED));
        reviews();

        trustScoreService.recalculate(userId);

        assertThat(baseUser.getTrustScore()).isEqualTo(0.0);
    }

    @Test
    void recalculate_stampsTheCurrentScoringRule() {
        baseUser.setTrustScoreVersion(3);
        connections();
        reviews();

        trustScoreService.recalculate(userId);

        assertThat(baseUser.getTrustScoreVersion()).isEqualTo(TrustScoreService.CURRENT_VERSION);
    }

    // ── Tiers (rebased) ──────────────────────────────────────────────────────

    @Test
    void tierFor_usesRebasedThresholds() {
        assertThat(TrustScoreService.tierFor(0)).isEqualTo("New Member");
        assertThat(TrustScoreService.tierFor(1)).isEqualTo("Getting Started");
        assertThat(TrustScoreService.tierFor(15)).isEqualTo("Reliable");
        assertThat(TrustScoreService.tierFor(45)).isEqualTo("Highly Trusted");
        assertThat(TrustScoreService.tierFor(90)).isEqualTo("Community Champion");
    }
}
