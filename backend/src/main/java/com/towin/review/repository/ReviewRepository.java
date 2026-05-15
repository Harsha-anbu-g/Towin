package com.towin.review.repository;

import com.towin.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    List<Review> findByRevieweeIdOrderByCreatedAtDesc(UUID revieweeId);

    List<Review> findByReviewerIdOrderByCreatedAtDesc(UUID reviewerId);

    boolean existsByNeedIdAndReviewerId(UUID needId, UUID reviewerId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.reviewee.id = :userId")
    Double findAverageRatingByRevieweeId(@Param("userId") UUID userId);

    long countByRevieweeIdAndSafetyConcernTrue(UUID revieweeId);
}
