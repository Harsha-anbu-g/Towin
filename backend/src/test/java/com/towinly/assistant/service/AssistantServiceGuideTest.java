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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The guide passages ride in the system prompt when the retriever has some, and only then. */
class AssistantServiceGuideTest {

    private GroqClient groq;
    private GuideRetriever retriever;
    private AssistantService service;

    @BeforeEach
    void setUp() {
        groq = mock(GroqClient.class);
        when(groq.isConfigured()).thenReturn(true);
        when(groq.complete(anyString(), any())).thenReturn(Optional.of(new GroqReply("ok", 0, 0, 0)));
        retriever = mock(GuideRetriever.class);
        service = new AssistantService(groq,
                mock(ProfileService.class), mock(StreakService.class), mock(ConnectionRepository.class),
                mock(NeedRepository.class), mock(TrustScoreService.class), mock(AssistantSpend.class),
                mock(AssistantTools.class), retriever);
    }

    private String promptFor(String question) {
        ChatRequest r = new ChatRequest();
        r.setMessage(question);
        service.answer(r, null, "en");
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(groq).complete(prompt.capture(), any());
        return prompt.getValue();
    }

    @Test
    void passagesAreAddedUnderTheirOwnHeading_withTheRule() {
        when(retriever.passagesFor("How do I check in?")).thenReturn(Optional.of("[A]\nTap I'm here today."));

        String prompt = promptFor("How do I check in?");

        assertThat(prompt).contains("=== FROM THE USER GUIDE ===");
        assertThat(prompt).contains("[A]\nTap I'm here today.");
        assertThat(prompt).contains("Prefer these passages for how-to steps and button names");
    }

    @Test
    void noPassages_noHeading() {
        when(retriever.passagesFor(anyString())).thenReturn(Optional.empty());

        assertThat(promptFor("Hello")).doesNotContain("FROM THE USER GUIDE");
    }

    @Test
    void theRetrieverSeesTheSanitizedQuestion() {
        when(retriever.passagesFor(anyString())).thenReturn(Optional.empty());

        promptFor("​How do I check in?");

        verify(retriever).passagesFor("How do I check in?");
    }

    @Test
    void anUnreadableQuestion_neverReachesTheRetriever() {
        ChatRequest r = new ChatRequest();
        r.setMessage("​​");
        service.answer(r, null, "en");

        verify(retriever, never()).passagesFor(anyString());
    }
}
