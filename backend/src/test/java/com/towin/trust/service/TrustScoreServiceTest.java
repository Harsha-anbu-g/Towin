package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import com.towin.trust.dto.TrustScoreBreakdownResponse.CustomerCard;
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

    @InjectMocks TrustScoreService trustScoreService;

    UUID userId = UUID.randomUUID();
    User baseUser;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        baseUser = User.builder()
                .id(userId)
                .email("t@t.com").phone("123").passwordHash("x")
                .phoneVerified(false)
                .verificationStatus(VerificationStatus.NONE)
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

    private Connection connection(User customer, TrustLevel level) {
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

        assertThat(r.getTotalScore()).isEqualTo(11.0);
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
