package com.towin.review.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.DelegatedPower;
import com.towin.common.enums.TrustLevel;
import com.towin.common.exception.ForbiddenException;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.service.FamilyDelegationService;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.dto.ReviewRequest;
import com.towin.review.dto.ReviewResponse;
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guardian mode, power 4: Sarah writes her mother's review of the helper.
 *
 * The review stays Margaret's — it rests on Margaret's trusted friendship with
 * that helper and it counts towards his score as her word — while Sarah is
 * named as the one who wrote it down.
 */
@ExtendWith(MockitoExtension.class)
class ReviewOnBehalfTest {

    @Mock ReviewRepository reviewRepository;
    @Mock UserRepository userRepository;
    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository needApplicationRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock TrustScoreService trustScoreService;
    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyDelegationService familyDelegationService;
    @InjectMocks ReviewService reviewService;

    private User margaret;   // the parent, whose trusted friendship backs the review
    private User helper;     // the person being reviewed
    private User sarah;      // her daughter

    @BeforeEach
    void setUp() {
        margaret = User.builder().id(UUID.randomUUID()).email("margaret@t.com").build();
        helper = User.builder().id(UUID.randomUUID()).email("helper@t.com").build();
        sarah = User.builder().id(UUID.randomUUID()).email("sarah@t.com").build();
    }

    private ReviewRequest praising(UUID reviewee, UUID forElder) {
        ReviewRequest r = new ReviewRequest();
        r.setRevieweeId(reviewee);
        r.setRating(5);
        r.setComment("Always on time and very kind");
        r.setOnBehalfOfElderId(forElder);
        return r;
    }

    /** Margaret and the helper are fully trusted friends — the gate a review needs. */
    private void trustedFriendship(UUID a, UUID b) {
        when(connectionRepository.findBetweenUsers(a, b)).thenReturn(Optional.of(
                Connection.builder()
                        .id(UUID.randomUUID())
                        .status(ConnectionStatus.ACTIVE)
                        .currentTrustLevel(TrustLevel.TRUSTED)
                        .build()));
    }

    private void sarahMayLeaveReviews() {
        // assertDelegated is a no-op on a mock, which is exactly "she holds it".
    }

    private void sarahMayNotLeaveReviews() {
        doThrow(new ForbiddenException("You don't have permission to do this for them"))
                .when(familyDelegationService).assertDelegated(
                        sarah.getId(), margaret.getId(), DelegatedPower.LEAVE_REVIEWS);
    }

    @Test
    void delegatedFamilyMemberWritesTheReviewAsTheParentAndIsNamedAsTheWriter() {
        sarahMayLeaveReviews();
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        trustedFriendship(margaret.getId(), helper.getId());
        when(elderProfileRepository.findByUserId(margaret.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Margaret").build()));
        when(elderProfileRepository.findByUserId(sarah.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Sarah").build()));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReviewResponse response = reviewService.submitReview(
                sarah.getId(), praising(helper.getId(), margaret.getId()));

        ArgumentCaptor<Review> saved = ArgumentCaptor.forClass(Review.class);
        verify(reviewRepository).save(saved.capture());
        // Margaret's word about her helper; Sarah's hand on the keyboard.
        assertThat(saved.getValue().getReviewer().getId()).isEqualTo(margaret.getId());
        assertThat(saved.getValue().getActedBy().getId()).isEqualTo(sarah.getId());
        assertThat(response.getReviewerName()).isEqualTo("Margaret");
        assertThat(response.getActedByName()).isEqualTo("Sarah");
        // The score that moves is the helper's, credited from Margaret's review.
        verify(trustScoreService).recalculate(helper.getId());
    }

    @Test
    void familyMemberWithoutThePowerCannotReviewForTheParent() {
        sarahMayNotLeaveReviews();

        assertThatThrownBy(() -> reviewService.submitReview(
                sarah.getId(), praising(helper.getId(), margaret.getId())))
                .isInstanceOf(ForbiddenException.class);
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void thePersonWritingTheirOwnReviewIsUnaffectedAndNothingIsStamped() {
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        trustedFriendship(margaret.getId(), helper.getId());
        when(elderProfileRepository.findByUserId(margaret.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Margaret").build()));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // No onBehalfOfElderId: Margaret writing her own, exactly as before.
        ReviewResponse response = reviewService.submitReview(
                margaret.getId(), praising(helper.getId(), null));

        ArgumentCaptor<Review> saved = ArgumentCaptor.forClass(Review.class);
        verify(reviewRepository).save(saved.capture());
        assertThat(saved.getValue().getActedBy()).isNull();
        assertThat(response.getActedByName()).isNull();
        verify(familyDelegationService, never()).assertDelegated(any(), any(), any());
    }

    @Test
    void thePowerIsRecheckedSoRevokingItStopsTheNextReview() {
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        trustedFriendship(margaret.getId(), helper.getId());
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // Granted when she writes the first, taken back by Margaret straight after.
        org.mockito.Mockito.doNothing()
                .doThrow(new ForbiddenException("You don't have permission to do this for them"))
                .when(familyDelegationService).assertDelegated(
                        sarah.getId(), margaret.getId(), DelegatedPower.LEAVE_REVIEWS);

        reviewService.submitReview(sarah.getId(), praising(helper.getId(), margaret.getId()));

        assertThatThrownBy(() -> reviewService.submitReview(
                sarah.getId(), praising(helper.getId(), margaret.getId())))
                .isInstanceOf(ForbiddenException.class);
        verify(reviewRepository).save(any());  // only the first one landed
    }

    @Test
    void theFamilyMemberCannotReviewThemselvesUsingTheParentsGoodName() {
        // The obvious abuse: Sarah is a helper too, and writes her mother a glowing
        // review of Sarah. The plain "you cannot review yourself" rule has to look at
        // who is really typing, not only whose name is on it.
        sarahMayLeaveReviews();

        assertThatThrownBy(() -> reviewService.submitReview(
                sarah.getId(), praising(sarah.getId(), margaret.getId())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot review yourself");
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void theFamilyMemberCannotReachSomeoneTheParentHasNeverTrusted() {
        // Sarah may know this person; Margaret does not. The trusted-friends gate is
        // checked between the PARENT and the helper, so Sarah's own contacts give her
        // no extra reach.
        User stranger = User.builder().id(UUID.randomUUID()).email("stranger@t.com").build();
        sarahMayLeaveReviews();
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(stranger.getId())).thenReturn(Optional.of(stranger));
        when(connectionRepository.findBetweenUsers(margaret.getId(), stranger.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.submitReview(
                sarah.getId(), praising(stranger.getId(), margaret.getId())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("only review people you've connected with");
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void aSafetyReportNeverNamesTheFamilyMemberWhoWroteIt() {
        // Safety reports are anonymous on purpose. Naming the daughter who typed one
        // would point straight back at the parent it is meant to protect.
        Review report = Review.builder()
                .id(UUID.randomUUID())
                .reviewer(margaret)
                .reviewee(helper)
                .actedBy(sarah)
                .rating(1)
                .safetyConcern(true)
                .build();
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(helper.getId()))
                .thenReturn(java.util.List.of(report));

        ReviewResponse response = reviewService.getReviewsForUser(helper.getId()).get(0);

        assertThat(response.getReviewerName()).isEqualTo("Anonymous");
        assertThat(response.getActedByName()).isNull();
    }

    @Test
    void leavingReviewsIsNotAskedAboutAnyOtherPower() {
        // Holding LEAVE_REVIEWS must not quietly widen into managing the parent's
        // help requests or moving their trust along.
        sarahMayLeaveReviews();
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(userRepository.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));
        trustedFriendship(margaret.getId(), helper.getId());
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        reviewService.submitReview(sarah.getId(), praising(helper.getId(), margaret.getId()));

        verify(familyDelegationService, never())
                .assertDelegated(any(), any(), eq(DelegatedPower.MANAGE_HELP_REQUESTS));
        verify(familyDelegationService, never())
                .assertDelegated(any(), any(), eq(DelegatedPower.ADVANCE_TRUST));
        verify(familyDelegationService, never()).hasPower(any(), any(), any());
    }
}
