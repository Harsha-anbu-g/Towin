package com.towin.review.repository;

import com.towin.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    List<Review> findByRevieweeIdOrderByCreatedAtDesc(UUID revieweeId);

    boolean existsByNeedIdAndReviewerId(UUID needId, UUID reviewerId);
}
