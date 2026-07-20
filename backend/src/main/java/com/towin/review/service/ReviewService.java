package com.towin.review.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.DisplayNameResolver;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.common.enums.DelegatedPower;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.service.FamilyDelegationService;
import com.towin.need.entity.Need;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.dto.ReviewRequest;
import com.towin.review.dto.ReviewResponse;
import com.towin.review.entity.Review;
import com.towin.review.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final NeedRepository needRepository;
    private final NeedApplicationRepository needApplicationRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final TrustScoreService trustScoreService;
    private final ConnectionRepository connectionRepository;
    private final FamilyDelegationService familyDelegationService;

    @Transactional
    public ReviewResponse submitReview(UUID callerId, ReviewRequest request) {
        // Guardian mode: when the elder has trusted this family member with their
        // reviews, the review is the ELDER's — their connection, their trust level,
        // their name on it, their say about the helper. Settling that here, before
        // any check below, means every gate judges the elder: a family member can
        // never review someone their parent has not actually met and trusted.
        boolean writingForElder = request.getOnBehalfOfElderId() != null;
        UUID reviewerId = callerId;
        if (writingForElder) {
            familyDelegationService.assertDelegated(
                    callerId, request.getOnBehalfOfElderId(), DelegatedPower.LEAVE_REVIEWS);
            reviewerId = request.getOnBehalfOfElderId();
        }

        // Both halves matter: nobody reviews themselves, and a family member cannot
        // use their parent's good name to write a glowing review of themselves.
        if (reviewerId.equals(request.getRevieweeId()) || callerId.equals(request.getRevieweeId())) {
            throw new IllegalArgumentException("You cannot review yourself");
        }

        if (request.getNeedId() != null &&
                reviewRepository.existsByNeedIdAndReviewerId(request.getNeedId(), reviewerId)) {
            throw new IllegalArgumentException("You have already reviewed this service");
        }

        User reviewer = getUser(reviewerId);
        User reviewee = getUser(request.getRevieweeId());
        User actedBy = writingForElder ? getUser(callerId) : null;

        // Only fully trusted friends may review each other. A review feeds the trust
        // score, so without this gate it could be gamed (fake 5-stars to inflate a
        // near-stranger, fake 1-stars / safety flags to smear one). Finishing a job
        // together is NOT a shortcut past the ladder: the pair must be ACTIVE and
        // TRUSTED whether or not the review hangs off a need.
        Connection connection = connectionRepository
                .findBetweenUsers(reviewerId, request.getRevieweeId())
                .orElseThrow(() -> new IllegalArgumentException("You can only review people you've connected with"));
        if (connection.getStatus() != ConnectionStatus.ACTIVE
                || connection.getCurrentTrustLevel() != TrustLevel.TRUSTED) {
            throw new IllegalArgumentException("You can review each other once you're fully trusted friends");
        }

        // A review pinned to a need must also reflect that need: the reviewer was on
        // it, and the person being reviewed was on the other side of it.
        Need need = null;
        if (request.getNeedId() != null) {
            need = needRepository.findById(request.getNeedId())
                    .orElseThrow(() -> new IllegalArgumentException("Need not found"));
            // The reviewer must have been on this need (the elder or an applying helper)...
            boolean reviewerIsElder = need.getElder().getId().equals(reviewerId);
            boolean reviewerIsHelper = needApplicationRepository.existsByNeedIdAndHelperId(need.getId(), reviewerId);
            if (!reviewerIsElder && !reviewerIsHelper) {
                throw new IllegalArgumentException("You can only review users from needs you participated in");
            }
            // ...and the person being reviewed must be the *other* party on that same need.
            boolean revieweeIsCounterparty = reviewerIsElder
                    ? needApplicationRepository.existsByNeedIdAndHelperId(need.getId(), request.getRevieweeId())
                    : need.getElder().getId().equals(request.getRevieweeId());
            if (!revieweeIsCounterparty) {
                throw new IllegalArgumentException("You can only review the other person from that need");
            }
        }

        Review review = Review.builder()
                .reviewer(reviewer)
                .reviewee(reviewee)
                .actedBy(actedBy)
                .need(need)
                .rating(request.getRating())
                .tags(request.getTags())
                .comment(request.getComment())
                .safetyConcern(request.isSafetyConcern())
                .build();

        Review saved = reviewRepository.save(review);
        trustScoreService.recalculate(reviewee.getId());

        return toResponse(saved);
    }

    public List<ReviewResponse> getReviewsForUser(UUID userId) {
        return reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<ReviewResponse> getMyReviews(UUID userId) {
        return getReviewsForUser(userId);
    }

    public List<ReviewResponse> getReviewsGiven(UUID reviewerId) {
        return reviewRepository.findByReviewerIdOrderByCreatedAtDesc(reviewerId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private ReviewResponse toResponse(Review review) {
        String reviewerName = resolveDisplayName(review.getReviewer());
        // anonymize if safety concern
        if (Boolean.TRUE.equals(review.getSafetyConcern())) {
            reviewerName = "Anonymous";
        }

        // Guardian mode: name whoever wrote this for the reviewer — but never on a
        // safety report. Those are deliberately anonymous, and naming the daughter
        // who typed it would point straight back at the person it protects.
        String actedByName = review.getActedBy() != null && !Boolean.TRUE.equals(review.getSafetyConcern())
                ? resolveDisplayName(review.getActedBy())
                : null;

        return ReviewResponse.builder()
                .id(review.getId())
                .reviewerId(review.getReviewer().getId())
                .reviewerName(reviewerName)
                .actedByName(actedByName)
                .rating(review.getRating())
                .tags(review.getTags())
                .comment(review.getComment())
                .safetyConcern(review.getSafetyConcern())
                .createdAt(review.getCreatedAt())
                .build();
    }

    private String resolveDisplayName(User user) {
        // Reviews are public — they sit on the helper's profile for anyone to
        // read. This used to fall back to the reviewer's email address, which
        // published it to strangers; the shared resolver knows better.
        return DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, user);
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
