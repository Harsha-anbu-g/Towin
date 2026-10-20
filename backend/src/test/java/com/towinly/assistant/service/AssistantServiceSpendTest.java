package com.towinly.assistant.service;

import com.towinly.assistant.dto.ChatRequest;
import com.towinly.assistant.guide.GuideRetriever;
import com.towinly.common.service.TrustScoreService;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.profile.service.ProfileService;
import com.towinly.streak.service.StreakService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Every answer that reaches a person is booked; a failed call books nothing. */
class AssistantServiceSpendTest {

    private GroqClient groq;
    private AssistantSpend spend;
    private AssistantService service;

    @BeforeEach
    void setUp() {
        groq = mock(GroqClient.class);
        when(groq.isConfigured()).thenReturn(true);
        spend = mock(AssistantSpend.class);
        service = new AssistantService(
                groq,
                mock(ProfileService.class),
                mock(StreakService.class),
                mock(ConnectionRepository.class),
                mock(NeedRepository.class),
                mock(TrustScoreService.class),
                spend,
                mock(AssistantTools.class),
                mock(GuideRetriever.class));
    }

    private static ChatRequest ask(String message) {
        ChatRequest r = new ChatRequest();
        r.setMessage(message);
        return r;
    }

    @Test
    void anAnsweredQuestion_isBookedWithItsTokensLanguageAndUser() {
        // Signed in, so the tool-enabled call is the one that answers.
        when(groq.complete(anyString(), anyList(), any(), any(), anyBoolean()))
                .thenReturn(Optional.of(new GroqReply("Bonjour.", 4000, 120, 3800)));
        UUID user = UUID.randomUUID();

        String reply = service.answer(ask("Quel est mon score?"), user, "fr");

        assertThat(reply).isEqualTo("Bonjour.");
        ArgumentCaptor<GroqReply> booked = ArgumentCaptor.forClass(GroqReply.class);
        verify(spend).record(booked.capture(), eq("fr"), eq(user), anyLong());
        assertThat(booked.getValue().totalTokens()).isEqualTo(4120);
    }

    @Test
    void aFailedCall_booksNothing() {
        when(groq.complete(anyString(), any())).thenReturn(Optional.empty());

        service.answer(ask("Hello"), null, "en");

        verify(spend, never()).record(any(), anyString(), any(), anyLong());
    }

    @Test
    void anUnreadableQuestion_neverReachesGroq_soBooksNothing() {
        service.answer(ask("​​"), null, "en");

        verify(groq, never()).complete(anyString(), any());
        verify(spend, never()).record(any(), anyString(), any(), anyLong());
    }
}
