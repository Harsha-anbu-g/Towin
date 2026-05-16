package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ApplicationStatus;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.NeedStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrustScoreService {

    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final ReportRepository reportRepository;
    private final ConnectionRepository connectionRepository;
    private final NeedApplicationRepository needApplicationRepository;

    @Transactional
    public void recalculate(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        int score = 0;

        if (user.isPhoneVerified()) score += 10;

        if (user.getVerificationStatus() == VerificationStatus.VERIFIED) score += 20;

        long trustedCount = connectionRepository.countTrustedByUser(userId, TrustLevel.TRUSTED, ConnectionStatus.ACTIVE);
        score += (int) Math.min(trustedCount * 5L, 25);

        long completedServices = needApplicationRepository.countCompletedByHelper(userId, ApplicationStatus.ACCEPTED, NeedStatus.COMPLETED);
        score += (int) Math.min(completedServices * 3L, 15);

        Double avgRating = reviewRepository.findAverageRatingByRevieweeId(userId);
        if (avgRating != null) {
            score += (int) Math.round((avgRating - 1.0) / 4.0 * 10.0);
        }

        if (user.getCreatedAt().isBefore(LocalDateTime.now().minusDays(30))) score += 5;

        long reportCount = reportRepository.countByReportedUserId(userId);
        score -= (int) (reportCount * 15L);

        score = Math.max(0, Math.min(100, score));
        user.setTrustScore(score);

        long safetyConcernCount = reviewRepository.countByRevieweeIdAndSafetyConcernTrue(userId);
        if (score < 20 || safetyConcernCount >= 3) {
            user.setIsActive(false);
        }

        userRepository.save(user);
    }

    public static String tierFor(int score) {
        if (score >= 91) return "Community Champion";
        if (score >= 71) return "Highly Trusted";
        if (score >= 51) return "Reliable";
        if (score >= 31) return "Getting Started";
        return "New Member";
    }
}
