package com.towinly.report.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ReportedContent;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.TrustScoreService;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.service.PassOnVisibilityService;
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

    /**
     * One sentence for all three ways a content reference can be wrong — the writing is not
     * there, the reporter was never shown it, or the person named did not write it. Told
     * apart, this endpoint would answer "does user X have a story with id Y" for anybody
     * signed in, which is a question nobody outside the page is entitled to ask.
     */
    static final String NO_SUCH_WRITING = "We couldn't find that writing";
    static final String HALF_A_REFERENCE = "A report about something must say what that something is";

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final TrustScoreService trustScoreService;
    private final PassOnItemRepository passOnItemRepository;
    private final PassOnVisibilityService visibility;

    @Transactional
    public void submitReport(UUID reporterId, ReportRequest request) {
        if (reporterId.equals(request.getReportedUserId())) {
            throw new IllegalArgumentException("You cannot report yourself");
        }
        // Checked before either user is loaded: a malformed reference is a malformed request,
        // not something to discover halfway through saving.
        requireWholeReference(request);

        User reporter = getUser(reporterId);
        User reported = getUser(request.getReportedUserId());
        requireReportableContent(request, reporterId, reported.getId());

        Report report = Report.builder()
                .reporter(reporter)
                .reportedUser(reported)
                .reason(request.getReason())
                .description(request.getDescription())
                .contentType(request.getContentType())
                .contentId(request.getContentId())
                .build();

        reportRepository.save(report);
        trustScoreService.recalculate(reported.getId());
    }

    /** Half a pointer cannot be followed, so it is refused rather than stored. */
    private void requireWholeReference(ReportRequest request) {
        if ((request.getContentType() == null) != (request.getContentId() == null)) {
            throw new IllegalArgumentException(HALF_A_REFERENCE);
        }
    }

    /**
     * A content reference is evidence somebody will act on, so it is verified at the moment
     * it is filed rather than trusted: the writing has to exist, the reporter has to have
     * actually been shown it, and it has to belong to the person being named.
     *
     * The readability question is put to {@link PassOnVisibilityService} and to nothing else.
     * It is the single authority on who may read what an elder wrote, and a second opinion
     * here would be a second authority.
     */
    private void requireReportableContent(ReportRequest request, UUID reporterId, UUID reportedUserId) {
        if (request.getContentType() != ReportedContent.PASSON_ITEM) return;

        PassOnItem item = passOnItemRepository.findById(request.getContentId())
                .orElseThrow(() -> new IllegalArgumentException(NO_SUCH_WRITING));

        if (!visibility.canRead(item, reporterId)) {
            throw new IllegalArgumentException(NO_SUCH_WRITING);
        }
        if (!item.getOwner().getId().equals(reportedUserId)) {
            throw new IllegalArgumentException(NO_SUCH_WRITING);
        }
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
