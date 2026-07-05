package com.towin.report.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.report.dto.ReportRequest;
import com.towin.report.entity.Report;
import com.towin.report.repository.ReportRepository;
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

    @InjectMocks ReportService reportService;

    UUID reporterId = UUID.randomUUID();
    UUID reportedId = UUID.randomUUID();
    User reporter;
    User reported;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        reporter = User.builder().id(reporterId).email("reporter@t.com").build();
        reported = User.builder().id(reportedId).email("reported@t.com").build();
    }

    private ReportRequest request(UUID reportedUserId) {
        ReportRequest r = new ReportRequest();
        r.setReportedUserId(reportedUserId);
        r.setReason("HARASSMENT");
        r.setDescription("Sent threatening messages");
        return r;
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
}
