package com.towin.review.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.need.entity.Need;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.dto.ReviewRequest;
import com.towin.review.dto.ReviewResponse;
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewServiceTest {

    @Mock ReviewRepository reviewRepository;
    @Mock UserRepository userRepository;
    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository needApplicationRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock TrustScoreService trustScoreService;
    @Mock ConnectionRepository connectionRepository;

    @InjectMocks ReviewService reviewService;

    UUID reviewerId = UUID.randomUUID();
    UUID revieweeId = UUID.randomUUID();
    UUID needId = UUID.randomUUID();
    User reviewer;
    User reviewee;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        reviewer = User.builder().id(reviewerId).email("reviewer@t.com").build();
        reviewee = User.builder().id(revieweeId).email("reviewee@t.com").build();
    }

    private ReviewRequest request(UUID reviewee, UUID need, int rating) {
        ReviewRequest r = new ReviewRequest();
        r.setRevieweeId(reviewee);
        r.setNeedId(need);
        r.setRating(rating);
        r.setComment("Very kind and patient");
        return r;
    }

    private void bothUsersExist() {
        when(userRepository.findById(reviewerId)).thenReturn(Optional.of(reviewer));
        when(userRepository.findById(revieweeId)).thenReturn(Optional.of(reviewee));
    }

    /** A need owned by the given elder. */
    private Need need(User elder) {
        return Need.builder().id(needId).elder(elder).title("Grocery run").build();
    }

    private void saveEchoes() {
        when(reviewRepository.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    /** An ACTIVE connection at the top of the trust ladder — the only kind that
     *  may carry a review without a shared need. */
    private void connected() {
        connectedAt(ConnectionStatus.ACTIVE, TrustLevel.TRUSTED);
    }

    private void connectedAt(ConnectionStatus status, TrustLevel level) {
        when(connectionRepository.findBetweenUsers(reviewerId, revieweeId))
                .thenReturn(Optional.of(Connection.builder()
                        .userA(reviewer).userB(reviewee)
                        .status(status).currentTrustLevel(level)
                        .build()));
    }

    // ── submitReview: guards ─────────────────────────────────────────────────

    @Test
    void reviewingYourself_isRejected() {
        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(reviewerId, null, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot review yourself");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void secondReviewForTheSameNeed_isRejected_soRatingsAreNotDoubleCounted() {
        when(reviewRepository.existsByNeedIdAndReviewerId(needId, reviewerId)).thenReturn(true);

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, needId, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already reviewed");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void missingReviewer_throws() {
        when(userRepository.findById(reviewerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, null, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");

        verify(reviewRepository, never()).save(any());
    }

    @Test
    void missingReviewee_throws() {
        when(userRepository.findById(reviewerId)).thenReturn(Optional.of(reviewer));
        when(userRepository.findById(revieweeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, null, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");

        verify(reviewRepository, never()).save(any());
    }

    @Test
    void missingNeed_throws() {
        bothUsersExist();
        connected();
        when(needRepository.findById(needId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, needId, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Need not found");

        verify(reviewRepository, never()).save(any());
    }

    @Test
    void reviewerWhoWasNotOnTheNeed_isRejected() {
        bothUsersExist();
        connected();
        User someoneElsesElder = User.builder().id(UUID.randomUUID()).build();
        when(needRepository.findById(needId)).thenReturn(Optional.of(need(someoneElsesElder)));
        // reviewer never applied either (existsByNeedIdAndHelperId defaults to false)

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, needId, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("needs you participated in");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void elderCannotReviewSomeoneWhoNeverAppliedToTheNeed() {
        bothUsersExist();
        connected();
        when(needRepository.findById(needId)).thenReturn(Optional.of(need(reviewer)));
        when(needApplicationRepository.existsByNeedIdAndHelperId(needId, revieweeId)).thenReturn(false);

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, needId, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("other person from that need");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void helperCannotReviewSomeoneOtherThanTheNeedsElder() {
        bothUsersExist();
        connected();
        User actualElder = User.builder().id(UUID.randomUUID()).build();
        when(needRepository.findById(needId)).thenReturn(Optional.of(need(actualElder)));
        when(needApplicationRepository.existsByNeedIdAndHelperId(needId, reviewerId)).thenReturn(true);
        // reviewee is neither the elder nor relevant: counterparty check must fail

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, needId, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("other person from that need");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void reviewWithoutNeedOrConnection_isRejected_soStrangersCannotFeedTrustScores() {
        bothUsersExist();
        when(connectionRepository.findBetweenUsers(reviewerId, revieweeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, null, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("people you've connected with");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void reviewBeforeReachingFullTrust_isRejected_soTheLadderCannotBeSkipped() {
        bothUsersExist();
        connectedAt(ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL);

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, null, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fully trusted");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void reviewOnAPendingInvite_isRejected() {
        bothUsersExist();
        connectedAt(ConnectionStatus.PENDING, TrustLevel.TRUSTED);

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, null, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fully trusted");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    // A finished job is not a licence to rate: the trust ladder gates every review,
    // whether it hangs off a need or off the connection alone.

    @Test
    void reviewFromASharedNeedBeforeFullTrust_isRejected() {
        bothUsersExist();
        connectedAt(ConnectionStatus.ACTIVE, TrustLevel.VIDEO_CALL);

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, needId, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fully trusted");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void reviewFromASharedNeedWithNoConnection_isRejected() {
        bothUsersExist();
        when(connectionRepository.findBetweenUsers(reviewerId, revieweeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.submitReview(reviewerId, request(revieweeId, needId, 5)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("people you've connected with");

        verify(reviewRepository, never()).save(any());
        verify(trustScoreService, never()).recalculate(any());
    }

    // ── submitReview: happy paths ────────────────────────────────────────────

    @Test
    void elderReviewsHelperFromSharedNeed_savesReviewAndRecalculatesTrust() {
        bothUsersExist();
        saveEchoes();
        connected();
        Need need = need(reviewer);
        when(needRepository.findById(needId)).thenReturn(Optional.of(need));
        when(needApplicationRepository.existsByNeedIdAndHelperId(needId, revieweeId)).thenReturn(true);
        when(elderProfileRepository.findByUserId(reviewerId))
                .thenReturn(Optional.of(ElderProfile.builder().name("Martha").build()));

        ReviewResponse response = reviewService.submitReview(reviewerId, request(revieweeId, needId, 4));

        ArgumentCaptor<Review> saved = ArgumentCaptor.forClass(Review.class);
        verify(reviewRepository).save(saved.capture());
        assertThat(saved.getValue().getReviewer()).isSameAs(reviewer);
        assertThat(saved.getValue().getReviewee()).isSameAs(reviewee);
        assertThat(saved.getValue().getNeed()).isSameAs(need);
        assertThat(saved.getValue().getRating()).isEqualTo(4);

        verify(trustScoreService).recalculate(revieweeId);
        assertThat(response.getRating()).isEqualTo(4);
        assertThat(response.getComment()).isEqualTo("Very kind and patient");
        assertThat(response.getReviewerName()).isEqualTo("Martha");
    }

    @Test
    void helperReviewsTheNeedsElder_savesReview() {
        bothUsersExist();
        saveEchoes();
        connected();
        when(needRepository.findById(needId)).thenReturn(Optional.of(need(reviewee)));
        when(needApplicationRepository.existsByNeedIdAndHelperId(needId, reviewerId)).thenReturn(true);
        when(elderProfileRepository.findByUserId(reviewerId)).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(reviewerId))
                .thenReturn(Optional.of(HelperProfile.builder().name("Sam").build()));

        ReviewResponse response = reviewService.submitReview(reviewerId, request(revieweeId, needId, 5));

        verify(reviewRepository).save(any(Review.class));
        verify(trustScoreService).recalculate(revieweeId);
        assertThat(response.getReviewerName()).isEqualTo("Sam");
    }

    @Test
    void connectedUsersCanReviewEachOtherWithoutANeed() {
        bothUsersExist();
        saveEchoes();
        connected();
        when(elderProfileRepository.findByUserId(reviewerId)).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(reviewerId)).thenReturn(Optional.empty());

        ReviewResponse response = reviewService.submitReview(reviewerId, request(revieweeId, null, 3));

        ArgumentCaptor<Review> saved = ArgumentCaptor.forClass(Review.class);
        verify(reviewRepository).save(saved.capture());
        assertThat(saved.getValue().getNeed()).isNull();
        verify(trustScoreService).recalculate(revieweeId);
        // no profile at all: name falls back to the reviewer's email
        assertThat(response.getReviewerName()).isEqualTo("reviewer@t.com");
    }

    @Test
    void safetyConcernReview_hidesTheReviewersName() {
        bothUsersExist();
        saveEchoes();
        connected();
        when(elderProfileRepository.findByUserId(reviewerId))
                .thenReturn(Optional.of(ElderProfile.builder().name("Martha").build()));
        ReviewRequest req = request(revieweeId, null, 1);
        req.setSafetyConcern(true);

        ReviewResponse response = reviewService.submitReview(reviewerId, req);

        assertThat(response.getReviewerName()).isEqualTo("Anonymous");
        assertThat(response.getSafetyConcern()).isTrue();
        // Note: the reviewer's UUID is still exposed on the response even when anonymous.
        assertThat(response.getReviewerId()).isEqualTo(reviewerId);
    }

    // ── read paths ───────────────────────────────────────────────────────────

    @Test
    void getReviewsForUser_mapsEveryReviewWithResolvedNames() {
        User named = User.builder().id(UUID.randomUUID()).email("named@t.com").build();
        User unnamed = User.builder().id(UUID.randomUUID()).email("plain@t.com").build();
        Review first = Review.builder().reviewer(named).reviewee(reviewee).rating(5).safetyConcern(false).build();
        Review second = Review.builder().reviewer(unnamed).reviewee(reviewee).rating(2).safetyConcern(false).build();
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(revieweeId))
                .thenReturn(List.of(first, second));
        when(elderProfileRepository.findByUserId(named.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Martha").build()));
        when(elderProfileRepository.findByUserId(unnamed.getId())).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(unnamed.getId())).thenReturn(Optional.empty());

        List<ReviewResponse> responses = reviewService.getReviewsForUser(revieweeId);

        assertThat(responses).hasSize(2);
        assertThat(responses.get(0).getReviewerName()).isEqualTo("Martha");
        assertThat(responses.get(0).getRating()).isEqualTo(5);
        assertThat(responses.get(1).getReviewerName()).isEqualTo("plain@t.com");
        assertThat(responses.get(1).getRating()).isEqualTo(2);
    }

    @Test
    void getMyReviews_returnsReviewsAboutMe() {
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(revieweeId)).thenReturn(List.of());

        assertThat(reviewService.getMyReviews(revieweeId)).isEmpty();

        verify(reviewRepository).findByRevieweeIdOrderByCreatedAtDesc(revieweeId);
    }

    @Test
    void getReviewsGiven_listsReviewsIWrote() {
        Review mine = Review.builder().reviewer(reviewer).reviewee(reviewee).rating(4).safetyConcern(false).build();
        when(reviewRepository.findByReviewerIdOrderByCreatedAtDesc(reviewerId)).thenReturn(List.of(mine));
        when(elderProfileRepository.findByUserId(reviewerId)).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(reviewerId)).thenReturn(Optional.empty());

        List<ReviewResponse> responses = reviewService.getReviewsGiven(reviewerId);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).getRating()).isEqualTo(4);
        assertThat(responses.get(0).getReviewerId()).isEqualTo(reviewerId);
    }
}
