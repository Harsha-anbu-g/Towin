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

    @Transactional
    public ReviewResponse submitReview(UUID reviewerId, ReviewRequest request) {
        if (reviewerId.equals(request.getRevieweeId())) {
            throw new IllegalArgumentException("You cannot review yourself");
        }

        if (request.getNeedId() != null &&
                reviewRepository.existsByNeedIdAndReviewerId(request.getNeedId(), reviewerId)) {
            throw new IllegalArgumentException("You have already reviewed this service");
        }

        User reviewer = getUser(reviewerId);
        User reviewee = getUser(request.getRevieweeId());

        // A review must reflect a real interaction, or the trust score it feeds could
        // be gamed (fake 5-stars to inflate a stranger, fake 1-stars / safety flags to
        // smear one). Two legitimate paths: a shared need, or an existing connection.
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
        } else {
            // No need attached (connection-based review): the two must actually be
            // connected AND have reached the top of the trust ladder. The dashboards
            // only offer this review button on TRUSTED connections; enforce the same
            // rule here so the API can't rate someone you barely know.
            Connection connection = connectionRepository
                    .findBetweenUsers(reviewerId, request.getRevieweeId())
                    .orElseThrow(() -> new IllegalArgumentException("You can only review people you've connected with"));
            if (connection.getStatus() != ConnectionStatus.ACTIVE
                    || connection.getCurrentTrustLevel() != TrustLevel.TRUSTED) {
                throw new IllegalArgumentException("You can review each other once you're fully trusted friends");
            }
        }

        Review review = Review.builder()
                .reviewer(reviewer)
                .reviewee(reviewee)
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

        return ReviewResponse.builder()
                .id(review.getId())
                .reviewerId(review.getReviewer().getId())
                .reviewerName(reviewerName)
                .rating(review.getRating())
                .tags(review.getTags())
                .comment(review.getComment())
                .safetyConcern(review.getSafetyConcern())
                .createdAt(review.getCreatedAt())
                .build();
    }

    private String resolveDisplayName(User user) {
        return elderProfileRepository.findByUserId(user.getId())
                .map(p -> p.getName())
                .or(() -> helperProfileRepository.findByUserId(user.getId()).map(p -> p.getName()))
                .orElse(user.getEmail());
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
