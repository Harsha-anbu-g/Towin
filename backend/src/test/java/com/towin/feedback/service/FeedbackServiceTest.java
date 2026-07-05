package com.towin.feedback.service;

import com.towin.feedback.dto.FeedbackRequest;
import com.towin.feedback.dto.FeedbackResponse;
import com.towin.feedback.entity.Feedback;
import com.towin.feedback.repository.FeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedbackServiceTest {

    @Mock FeedbackRepository feedbackRepository;

    @InjectMocks FeedbackService feedbackService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    // ── submit ───────────────────────────────────────────────────────────────

    @Test
    void submit_savesEveryFieldFromTheRequest() {
        FeedbackRequest req = new FeedbackRequest();
        req.setName("Meena");
        req.setEmail("meena@test.com");
        req.setPhone("+911234567890");
        req.setMessage("The turtle is lovely.");
        req.setRatingIdea(5);
        req.setRatingUi(4);
        req.setRatingTheme(5);
        req.setRatingSecurity(3);
        req.setRatingEaseOfUse(4);
        req.setRatingPerformance(2);
        req.setRatingOverall(5);

        feedbackService.submit(req);

        ArgumentCaptor<Feedback> captor = ArgumentCaptor.forClass(Feedback.class);
        verify(feedbackRepository).save(captor.capture());
        Feedback saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("Meena");
        assertThat(saved.getEmail()).isEqualTo("meena@test.com");
        assertThat(saved.getPhone()).isEqualTo("+911234567890");
        assertThat(saved.getMessage()).isEqualTo("The turtle is lovely.");
        assertThat(saved.getRatingIdea()).isEqualTo(5);
        assertThat(saved.getRatingUi()).isEqualTo(4);
        assertThat(saved.getRatingTheme()).isEqualTo(5);
        assertThat(saved.getRatingSecurity()).isEqualTo(3);
        assertThat(saved.getRatingEaseOfUse()).isEqualTo(4);
        assertThat(saved.getRatingPerformance()).isEqualTo(2);
        assertThat(saved.getRatingOverall()).isEqualTo(5);
    }

    @Test
    void submit_acceptsMessageOnlyFeedbackWithoutIdentityOrRatings() {
        FeedbackRequest req = new FeedbackRequest();
        req.setMessage("Just a note, no name given.");

        feedbackService.submit(req);

        ArgumentCaptor<Feedback> captor = ArgumentCaptor.forClass(Feedback.class);
        verify(feedbackRepository).save(captor.capture());
        Feedback saved = captor.getValue();
        assertThat(saved.getMessage()).isEqualTo("Just a note, no name given.");
        assertThat(saved.getName()).isNull();
        assertThat(saved.getEmail()).isNull();
        assertThat(saved.getPhone()).isNull();
        assertThat(saved.getRatingOverall()).isNull();
    }

    // ── getAll ───────────────────────────────────────────────────────────────

    @Test
    void getAll_asksForNewestFeedbackFirst() {
        when(feedbackRepository.findAll(any(Sort.class))).thenReturn(List.of());

        feedbackService.getAll();

        ArgumentCaptor<Sort> captor = ArgumentCaptor.forClass(Sort.class);
        verify(feedbackRepository).findAll(captor.capture());
        Sort.Order order = captor.getValue().getOrderFor("createdAt");
        assertThat(order).isNotNull();
        assertThat(order.getDirection()).isEqualTo(Sort.Direction.DESC);
    }

    @Test
    void getAll_mapsEntityFieldsOntoTheResponse() {
        Feedback stored = Feedback.builder()
                .id(UUID.randomUUID())
                .name("Ravi")
                .email("ravi@test.com")
                .phone("+919999999999")
                .message("Very easy to use.")
                .ratingIdea(5)
                .ratingUi(4)
                .ratingTheme(3)
                .ratingSecurity(5)
                .ratingEaseOfUse(5)
                .ratingPerformance(4)
                .ratingOverall(5)
                .createdAt(LocalDateTime.of(2026, 7, 1, 12, 0))
                .build();
        when(feedbackRepository.findAll(any(Sort.class))).thenReturn(List.of(stored));

        List<FeedbackResponse> result = feedbackService.getAll();

        assertThat(result).hasSize(1);
        FeedbackResponse r = result.get(0);
        assertThat(r.getId()).isEqualTo(stored.getId());
        assertThat(r.getName()).isEqualTo("Ravi");
        assertThat(r.getEmail()).isEqualTo("ravi@test.com");
        assertThat(r.getPhone()).isEqualTo("+919999999999");
        assertThat(r.getMessage()).isEqualTo("Very easy to use.");
        assertThat(r.getRatingIdea()).isEqualTo(5);
        assertThat(r.getRatingUi()).isEqualTo(4);
        assertThat(r.getRatingTheme()).isEqualTo(3);
        assertThat(r.getRatingSecurity()).isEqualTo(5);
        assertThat(r.getRatingEaseOfUse()).isEqualTo(5);
        assertThat(r.getRatingPerformance()).isEqualTo(4);
        assertThat(r.getRatingOverall()).isEqualTo(5);
        assertThat(r.getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 7, 1, 12, 0));
    }

    @Test
    void getAll_returnsEmptyListWhenThereIsNoFeedback() {
        when(feedbackRepository.findAll(any(Sort.class))).thenReturn(List.of());

        assertThat(feedbackService.getAll()).isEmpty();
    }
}
