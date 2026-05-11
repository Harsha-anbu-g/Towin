package com.towin.review.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.need.entity.Need;
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
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;

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

        Need need = null;
        if (request.getNeedId() != null) {
            need = needRepository.findById(request.getNeedId())
                    .orElseThrow(() -> new IllegalArgumentException("Need not found"));
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
        updateTrustScore(reviewee);

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

    private void updateTrustScore(User reviewee) {
        List<Review> allReviews = reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(reviewee.getId());

        int score = 0;

        // +3 per review received, max +15
        int servicePoints = Math.min(allReviews.size() * 3, 15);
        score += servicePoints;

        // rating bonus/penalty per review
        for (Review r : allReviews) {
            if (r.getRating() == 5) score += 2;
            else if (r.getRating() == 4) score += 1;
            else if (r.getRating() <= 2) score -= 1;

            // safety concern penalty
            if (Boolean.TRUE.equals(r.getSafetyConcern())) score -= 15;
        }

        reviewee.setTrustScore(Math.max(0, Math.min(100, score)));
        userRepository.save(reviewee);
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
