package com.towinly.report.service;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.TrustScoreService;
import com.towinly.report.dto.ReportRequest;
import com.towinly.report.entity.Report;
import com.towinly.report.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final TrustScoreService trustScoreService;

    @Transactional
    public void submitReport(UUID reporterId, ReportRequest request) {
        if (reporterId.equals(request.getReportedUserId())) {
            throw new IllegalArgumentException("You cannot report yourself");
        }

        User reporter = getUser(reporterId);
        User reported = getUser(request.getReportedUserId());

        Report report = Report.builder()
                .reporter(reporter)
                .reportedUser(reported)
                .reason(request.getReason())
                .description(request.getDescription())
                .build();

        reportRepository.save(report);
        trustScoreService.recalculate(reported.getId());
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
