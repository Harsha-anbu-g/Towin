package com.towinly.assistant.service;

import com.towinly.assistant.dto.ChatMessage;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The two guards on the way in and the way out. */
class AssistantServiceGuardTest {

    private LlmClient llm;
    private AssistantService service;

    @BeforeEach
    void setUp() {
        llm = mock(LlmClient.class);
        when(llm.isConfigured()).thenReturn(true);
        service = new AssistantService(llm,
                mock(ProfileService.class), mock(StreakService.class), mock(ConnectionRepository.class),
                mock(NeedRepository.class), mock(TrustScoreService.class), mock(AssistantSpend.class),
                mock(AssistantTools.class), mock(GuideRetriever.class));
    }

    private static ChatRequest ask(String message, ChatMessage... history) {
        ChatRequest r = new ChatRequest();
        r.setMessage(message);
        r.setHistory(List.of(history));
        return r;
    }

    @SuppressWarnings("unchecked")
    @Test
    void phoneNumbersAndEmails_neverLeaveForTheModel() {
        when(llm.complete(anyString(), any())).thenReturn(Optional.of(new LlmReply("ok", 0, 0, 0)));

        service.answer(ask("My number is 514-555-0199", new ChatMessage("user", "write to mary@example.com")), null, "en");

        ArgumentCaptor<List<ChatMessage>> sent = ArgumentCaptor.forClass(List.class);
        verify(llm).complete(anyString(), sent.capture());
        assertThat(sent.getValue()).extracting(ChatMessage::getContent)
                .containsExactly("write to [email]", "My number is [number]");
    }

    @Test
    void aReplyThatAsksForAPassword_isWithheld() {
        when(llm.complete(anyString(), any())).thenReturn(Optional.of(new LlmReply("Please type your password here.", 1, 1, 0)));

        assertThat(service.answer(ask("help"), null, "en")).startsWith("Sorry");
    }

    @Test
    void aKindReply_passes() {
        when(llm.complete(anyString(), any())).thenReturn(Optional.of(new LlmReply("There are 7 stages.", 1, 1, 0)));

        assertThat(service.answer(ask("How many stages?"), null, "en")).isEqualTo("There are 7 stages.");
    }
}
