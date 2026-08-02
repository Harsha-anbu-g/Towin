package com.towinly.report.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.ReportedContent;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.TrustScoreService;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.service.PassOnVisibilityService;
import com.towinly.report.dto.ReportRequest;
import com.towinly.report.entity.Report;
import com.towinly.report.repository.ReportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ReportServiceTest {

    @Mock ReportRepository reportRepository;
    @Mock UserRepository userRepository;
    @Mock TrustScoreService trustScoreService;
    @Mock PassOnItemRepository passOnItemRepository;
    @Mock PassOnVisibilityService visibility;

    @InjectMocks ReportService reportService;

    UUID reporterId = UUID.randomUUID();
    UUID reportedId = UUID.randomUUID();
    User reporter;
    User reported;
    PassOnItem story;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        reporter = User.builder().id(reporterId).email("reporter@t.com").build();
        reported = User.builder().id(reportedId).email("reported@t.com").build();
        story = PassOnItem.builder()
                .id(UUID.randomUUID())
                .owner(reported)
                .kind(PassOnKind.STORY)
                .title("The winter we lost the roof")
                .body("It came off in the night.")
                .audience(PassOnAudience.FAMILY)
                .releaseWhen(PassOnRelease.NOW)
                .build();
    }

    private ReportRequest request(UUID reportedUserId) {
        ReportRequest r = new ReportRequest();
        r.setReportedUserId(reportedUserId);
        r.setReason("HARASSMENT");
        r.setDescription("Sent threatening messages");
        return r;
    }

    /** The same report, but pointing at one particular thing the reported person wrote. */
    private ReportRequest aboutTheStory(UUID reportedUserId, UUID contentId) {
        ReportRequest r = request(reportedUserId);
        r.setContentType(ReportedContent.PASSON_ITEM);
        r.setContentId(contentId);
        return r;
    }

    private void theStoryIsThereAndTheReporterMayReadIt() {
        when(passOnItemRepository.findById(story.getId())).thenReturn(Optional.of(story));
        when(visibility.canRead(story, reporterId)).thenReturn(true);
    }

    private void bothUsersExist() {
        when(userRepository.findById(reporterId)).thenReturn(Optional.of(reporter));
        when(userRepository.findById(reportedId)).thenReturn(Optional.of(reported));
    }

    @Test
    void submitReport_savesOpenReportAgainstReportedUser() {
        bothUsersExist();

        reportService.submitReport(reporterId, request(reportedId));

        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(saved.capture());
        Report report = saved.getValue();
        assertThat(report.getReporter()).isSameAs(reporter);
        assertThat(report.getReportedUser()).isSameAs(reported);
        assertThat(report.getReason()).isEqualTo("HARASSMENT");
        assertThat(report.getDescription()).isEqualTo("Sent threatening messages");
        assertThat(report.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void submitReport_recalculatesTrustScoreOfReportedUser() {
        bothUsersExist();

        reportService.submitReport(reporterId, request(reportedId));

        verify(trustScoreService).recalculate(reportedId);
        verify(trustScoreService, never()).recalculate(reporterId);
    }

    @Test
    void reportingYourself_isRejected() {
        assertThatThrownBy(() -> reportService.submitReport(reporterId, request(reporterId)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot report yourself");

        verify(reportRepository, never()).save(any());
        verifyNoInteractions(trustScoreService);
    }

    @Test
    void missingReporter_throwsAndNothingIsSaved() {
        when(userRepository.findById(reporterId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.submitReport(reporterId, request(reportedId)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");

        verify(reportRepository, never()).save(any());
        verifyNoInteractions(trustScoreService);
    }

    @Test
    void missingReportedUser_throwsAndNothingIsSaved() {
        when(userRepository.findById(reporterId)).thenReturn(Optional.of(reporter));
        when(userRepository.findById(reportedId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.submitReport(reporterId, request(reportedId)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");

        verify(reportRepository, never()).save(any());
        verifyNoInteractions(trustScoreService);
    }

    // ── Objecting to one particular thing somebody wrote ───────────────────────────────
    //
    // Until "What I pass on", a report could only ever say "this person". A living person
    // named in an elder's story needs to be able to say *which story*, so the report carries
    // a content reference. That reference is evidence an admin will act on, so all three of
    // its failure modes are refusals rather than a stored guess — and all three answer with
    // the same sentence, so the endpoint cannot be used to find out which one it was.

    @Test
    void reportAboutAStory_storesWhichStoryItWasAbout() {
        bothUsersExist();
        theStoryIsThereAndTheReporterMayReadIt();

        reportService.submitReport(reporterId, aboutTheStory(reportedId, story.getId()));

        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(saved.capture());
        assertThat(saved.getValue().getContentType()).isEqualTo(ReportedContent.PASSON_ITEM);
        assertThat(saved.getValue().getContentId()).isEqualTo(story.getId());
    }

    @Test
    void reportAboutAPersonAlone_stillStoresWithNoContentReference() {
        bothUsersExist();

        reportService.submitReport(reporterId, request(reportedId));

        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(saved.capture());
        assertThat(saved.getValue().getContentType()).isNull();
        assertThat(saved.getValue().getContentId()).isNull();
        verifyNoInteractions(passOnItemRepository, visibility);
    }

    @Test
    void contentIdWithNoTypeSayingWhatItIs_isRejected() {
        ReportRequest r = aboutTheStory(reportedId, story.getId());
        r.setContentType(null);

        assertThatThrownBy(() -> reportService.submitReport(reporterId, r))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(ReportService.HALF_A_REFERENCE);

        verify(reportRepository, never()).save(any());
    }

    @Test
    void contentTypeWithNothingItPointsAt_isRejected() {
        ReportRequest r = aboutTheStory(reportedId, story.getId());
        r.setContentId(null);

        assertThatThrownBy(() -> reportService.submitReport(reporterId, r))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(ReportService.HALF_A_REFERENCE);

        verify(reportRepository, never()).save(any());
    }

    @Test
    void writingThatIsNotThere_isRejected() {
        bothUsersExist();
        UUID nothing = UUID.randomUUID();
        when(passOnItemRepository.findById(nothing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.submitReport(reporterId, aboutTheStory(reportedId, nothing)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(ReportService.NO_SUCH_WRITING);

        verify(reportRepository, never()).save(any());
    }

    @Test
    void writingTheReporterWasNeverShown_isRejected() {
        bothUsersExist();
        when(passOnItemRepository.findById(story.getId())).thenReturn(Optional.of(story));
        when(visibility.canRead(story, reporterId)).thenReturn(false);

        assertThatThrownBy(() -> reportService.submitReport(reporterId, aboutTheStory(reportedId, story.getId())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(ReportService.NO_SUCH_WRITING);

        verify(reportRepository, never()).save(any());
    }

    @Test
    void writingTheAccusedPersonDidNotWrite_isRejected() {
        // The story belongs to `reported`; this report names a third person. An admin must
        // never be handed a reference saying somebody wrote what they did not write.
        UUID bystanderId = UUID.randomUUID();
        User bystander = User.builder().id(bystanderId).email("bystander@t.com").build();
        when(userRepository.findById(reporterId)).thenReturn(Optional.of(reporter));
        when(userRepository.findById(bystanderId)).thenReturn(Optional.of(bystander));
        theStoryIsThereAndTheReporterMayReadIt();

        assertThatThrownBy(() -> reportService.submitReport(reporterId, aboutTheStory(bystanderId, story.getId())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(ReportService.NO_SUCH_WRITING);

        verify(reportRepository, never()).save(any());
    }

    @Test
    void aBadReference_neverMovesAnybodysTrustScore() {
        bothUsersExist();
        when(passOnItemRepository.findById(story.getId())).thenReturn(Optional.of(story));
        when(visibility.canRead(story, reporterId)).thenReturn(false);

        assertThatThrownBy(() -> reportService.submitReport(reporterId, aboutTheStory(reportedId, story.getId())))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(trustScoreService);
    }
}
