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
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class TrustScoreServiceTest {

    @Mock UserRepository userRepository;
    @Mock HelperProfileRepository helperProfileRepository;
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
    }

    private void stubEmpty() {
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of());
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
    }

    // ── Basic Score ──────────────────────────────────────────────────────────

    @Test
    void basicScore_0_25_whenOnlyPhoneVerified() {
        baseUser.setPhoneVerified(true);
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        stubEmpty();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getBasic().getEarned()).isEqualTo(0.25);
    }

    @Test
    void basicScore_2_0_whenAllEightFieldsFilled() {
        baseUser.setPhoneVerified(true);
        baseUser.setVerificationStatus(VerificationStatus.VERIFIED);
        HelperProfile profile = HelperProfile.builder()
                .photoUrl("https://photo.jpg")
                .facebookUrl("https://facebook.com/me")
                .hobbies(new String[]{"reading"})
                .occupation("Teacher")
                .bio("Hello world")
                .dateOfBirth(LocalDate.of(1960, 1, 1))
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        stubEmpty();

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getBasic().getEarned()).isEqualTo(2.0);
        assertThat(r.getBasic().getMax()).isEqualTo(2.0);
    }

    // ── Rooting Score ────────────────────────────────────────────────────────

    @Test
    void rootingScore_0_whenConnectionAtDiscovered() {
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.DISCOVERED).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(0);
    }

    @Test
    void rootingScore_1_whenOneConnectionAtMessaging() {
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.MESSAGING).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(1);
    }

    @Test
    void rootingScore_5_whenOneConnectionAtTrusted() {
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.TRUSTED).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(5);
    }

    @Test
    void rootingScore_3_whenConnectionAtVerified_verifiedIsNotASpecStage() {
        // VERIFIED(4) is not a spec stage — earns same as VIDEO_CALL(3) = 3 pts
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.VERIFIED).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(3);
    }

    @Test
    void rootingScore_isAdditiveAcrossConnections() {
        Connection c1 = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.MESSAGING).build();
        Connection c2 = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.PHONE_CALL).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c1, c2));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        // MESSAGING=1 + PHONE_CALL=2 = 3
        assertThat(r.getRooting().getEarned()).isEqualTo(3);
        assertThat(r.getRooting().getRelationshipCount()).isEqualTo(2);
    }

    // ── Review Score ─────────────────────────────────────────────────────────

    @Test
    void reviewScore_isSumNotAverage() {
        // 5-star reviews: 5 + 3 + 4 = 12 (not avg 4.0)
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(any(), any())).thenReturn(List.of());
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(12);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getReview().getEarned()).isEqualTo(12);
    }

    // ── Total ────────────────────────────────────────────────────────────────

    @Test
    void totalScore_isSumOfThreeParts() {
        // basic=0.25 (phone only) + rooting=1 (MESSAGING) + review=5 (one 5-star) = 6.25
        baseUser.setPhoneVerified(true);
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.MESSAGING).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(5);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getTotalScore()).isEqualTo(6.25);
    }
}
