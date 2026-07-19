package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Family point (user decision 2026-07-18): elders earn ONE flat trust point
 * once any family member is linked — never more, however many links — and the
 * point repeats in every active customer block, like profile points.
 * HELPER, BOTH and FAMILY roles earn 0 from this component; PENDING links count 0.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrustScoreServiceFamilyPointsTest {

    @Mock UserRepository userRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock com.towin.common.service.S3Service s3Service;
    @Mock FamilyLinkRepository familyLinkRepository;

    @InjectMocks TrustScoreService trustScoreService;

    @Captor ArgumentCaptor<Collection<FamilyLinkStatus>> statusesCaptor;

    UUID userId = UUID.randomUUID();
    User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(userId)
                .email("t@t.com").phone("123").passwordHash("x")
                .phoneVerified(false)
                .verificationStatus(VerificationStatus.NONE)
                .role(UserRole.ELDER)
                .trustScore(0.0)
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of());
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
    }

    private void activeLinks(long count) {
        when(familyLinkRepository.countByElderIdAndStatusIn(eq(userId), anyCollection()))
                .thenReturn(count);
    }

    @Test
    void anyActiveLink_earnsOneFlatPoint_forElder() {
        activeLinks(2);

        trustScoreService.recalculate(userId);

        assertThat(user.getTrustScore()).isEqualTo(1.0);
    }

    @Test
    void fiveActiveLinks_stillOneFlatPoint() {
        activeLinks(5);

        trustScoreService.recalculate(userId);

        assertThat(user.getTrustScore()).isEqualTo(1.0);
    }

    @Test
    void familyPoint_repeatsInEveryCustomerBlock() {
        activeLinks(3); // still just one flat point
        Connection c1 = connectionTo(TrustLevel.DISCOVERED);
        Connection c2 = connectionTo(TrustLevel.DISCOVERED);
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE))
                .thenReturn(List.of(c1, c2));

        trustScoreService.recalculate(userId);

        // standalone (profile 0 + family 1) + 2 × (rooting 1 + review 0 + profile 0 + family 1)
        assertThat(user.getTrustScore()).isEqualTo(5.0);
    }

    private Connection connectionTo(TrustLevel level) {
        User other = User.builder().id(UUID.randomUUID()).build();
        return Connection.builder().userA(user).userB(other).currentTrustLevel(level).build();
    }

    @Test
    void onlyActiveLinksAreCounted_pendingEarnsNothing() {
        activeLinks(0);

        trustScoreService.recalculate(userId);

        assertThat(user.getTrustScore()).isEqualTo(0.0);
        verify(familyLinkRepository).countByElderIdAndStatusIn(eq(userId), statusesCaptor.capture());
        assertThat(statusesCaptor.getValue()).containsExactly(FamilyLinkStatus.ACTIVE);
    }

    @Test
    void bothRole_earnsZero_ruleIsElderOnly() {
        user.setRole(UserRole.BOTH);
        activeLinks(3);

        trustScoreService.recalculate(userId);

        assertThat(user.getTrustScore()).isEqualTo(0.0);
    }

    @Test
    void helperHoldingLinksAsFamilySide_earnsZero() {
        user.setRole(UserRole.HELPER);

        trustScoreService.recalculate(userId);

        assertThat(user.getTrustScore()).isEqualTo(0.0);
        verifyNoInteractions(familyLinkRepository);
    }

    @Test
    void familyRole_earnsZero() {
        user.setRole(UserRole.FAMILY);

        trustScoreService.recalculate(userId);

        assertThat(user.getTrustScore()).isEqualTo(0.0);
        verifyNoInteractions(familyLinkRepository);
    }

    @Test
    void breakdown_includesFamilyComponent_forElder() {
        activeLinks(2);

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getFamily()).isNotNull();
        assertThat(r.getFamily().getEarned()).isEqualTo(1);
        assertThat(r.getFamily().getMax()).isEqualTo(1);
        assertThat(r.getTotalScore()).isEqualTo(1.0);
    }

    @Test
    void elderProfile_hasTwoGroups_maxTwo() {
        user.setPhoneVerified(true);
        user.setVerificationStatus(VerificationStatus.VERIFIED);
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(HelperProfile.builder()
                .photoUrl("https://photo.jpg").bio("Hi there").dateOfBirth(LocalDate.of(1950, 1, 1))
                .occupation("Retired").hobbies(new String[]{"gardening"})
                .facebookUrl("https://facebook.com/me").build()));
        activeLinks(1);

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getProfile().getMax()).isEqualTo(2);
        assertThat(r.getProfile().getEarned()).isEqualTo(2);
        assertThat(r.getProfile().getGroups()).hasSize(2);
        // profile 2 + family 1, standalone (no connections stubbed)
        assertThat(r.getTotalScore()).isEqualTo(3.0);
    }

    @Test
    void breakdown_hasNoFamilyComponent_forNonElders() {
        user.setRole(UserRole.HELPER);

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getFamily()).isNull();
    }
}
