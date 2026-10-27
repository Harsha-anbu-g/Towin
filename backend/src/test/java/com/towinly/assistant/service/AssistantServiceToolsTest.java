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

import java.util.List;
import java.util.Map;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Tools are offered to signed-in people only; one tool round; both calls booked as one answer. */
class AssistantServiceToolsTest {

    private static final UUID ME = UUID.randomUUID();
    private static final LlmReply.ToolCall CALL = new LlmReply.ToolCall("call_1", "get_my_connections", "{}");

    private LlmClient llm;
    private AssistantTools tools;
    private AssistantSpend spend;
    private AssistantService service;

    @BeforeEach
    void setUp() {
        llm = mock(LlmClient.class);
        when(llm.isConfigured()).thenReturn(true);
        tools = mock(AssistantTools.class);
        spend = mock(AssistantSpend.class);
        service = new AssistantService(llm,
                mock(ProfileService.class), mock(StreakService.class), mock(ConnectionRepository.class),
                mock(NeedRepository.class), mock(TrustScoreService.class), spend, tools,
                mock(GuideRetriever.class));
    }

    private static ChatRequest ask(String message) {
        ChatRequest r = new ChatRequest();
        r.setMessage(message);
        return r;
    }

    @Test
    void aVisitor_getsNoTools_andTheOldCall() {
        when(llm.complete(anyString(), anyList())).thenReturn(Optional.of(new LlmReply("Hi.", 1, 1, 0)));

        assertThat(service.answer(ask("Hello"), null, "en")).isEqualTo("Hi.");

        verify(llm).complete(anyString(), anyList());
        verify(llm, never()).complete(anyString(), anyList(), any(), any(), anyBoolean());
    }

    @Test
    void aSignedInPerson_isOfferedTheThreeTools_withAutoChoice() {
        when(llm.complete(anyString(), anyList(), any(), any(), anyBoolean()))
                .thenReturn(Optional.of(new LlmReply("Your score is 12.", 10, 5, 0)));

        assertThat(service.answer(ask("What is my score?"), ME, "en")).isEqualTo("Your score is 12.");

        verify(llm).complete(anyString(), anyList(), eq(AssistantTools.DEFINITIONS), eq("auto"), eq(true));
        verify(tools, never()).run(anyString(), any());
        verify(spend).record(any(), eq("en"), eq(ME), anyLong());
    }

    @SuppressWarnings("unchecked")
    @Test
    void aToolCall_isRun_andTheSecondCallGetsTheResult_withNoMoreTools() {
        when(llm.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new LlmReply("", 4000, 20, 3800, List.of(CALL))));
        when(tools.run("get_my_connections", ME)).thenReturn("- Rita (Helper): active, at Phone Ready.");
        when(llm.complete(anyString(), anyList(), any(), any(), eq(false)))
                .thenReturn(Optional.of(new LlmReply("Rita is at Phone Ready.", 4300, 90, 4000)));

        String reply = service.answer(ask("Where is Rita?"), ME, "en");

        assertThat(reply).isEqualTo("Rita is at Phone Ready.");
        ArgumentCaptor<List<Map<String, Object>>> second = ArgumentCaptor.forClass(List.class);
        // Groq's documented follow-up: no tools offered again, the model can only answer in words.
        verify(llm).complete(anyString(), second.capture(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(), eq(false));
        List<Map<String, Object>> turns = second.getValue();
        // The echoed assistant turn must carry a string content: Groq rejects a missing one with a 400.
        assertThat(turns.get(turns.size() - 2)).containsEntry("role", "assistant")
                .containsEntry("content", "")
                .containsKey("tool_calls");
        assertThat(turns.get(turns.size() - 1)).containsEntry("role", "tool")
                .containsEntry("tool_call_id", "call_1")
                .containsEntry("content", "- Rita (Helper): active, at Phone Ready.");

        ArgumentCaptor<LlmReply> booked = ArgumentCaptor.forClass(LlmReply.class);
        verify(spend).record(booked.capture(), eq("en"), eq(ME), anyLong());
        assertThat(booked.getValue().promptTokens()).isEqualTo(8300);
        assertThat(booked.getValue().completionTokens()).isEqualTo(110);
    }

    @Test
    void ifTheSecondCallFails_theFirstIsStillBooked_andTheFallbackIsSaid() {
        when(llm.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new LlmReply("", 4000, 20, 0, List.of(CALL))));
        when(tools.run(anyString(), any())).thenReturn("No connections yet.");
        when(llm.complete(anyString(), anyList(), any(), any(), eq(false))).thenReturn(Optional.empty());

        assertThat(service.answer(ask("Who is waiting?"), ME, "en")).startsWith("Sorry");

        ArgumentCaptor<LlmReply> booked = ArgumentCaptor.forClass(LlmReply.class);
        verify(spend).record(booked.capture(), eq("en"), eq(ME), anyLong());
        assertThat(booked.getValue().totalTokens()).isEqualTo(4020);
    }

    @Test
    void severalToolCalls_inOneReply_areAllRun() {
        LlmReply.ToolCall fam = new LlmReply.ToolCall("call_2", "get_my_family", "{}");
        when(llm.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new LlmReply("", 1, 1, 0, List.of(CALL, fam))));
        when(tools.run(anyString(), any())).thenReturn("nothing");
        when(llm.complete(anyString(), anyList(), any(), any(), eq(false)))
                .thenReturn(Optional.of(new LlmReply("Done.", 1, 1, 0)));

        service.answer(ask("Everything?"), ME, "en");

        verify(tools).run("get_my_connections", ME);
        verify(tools).run("get_my_family", ME);
        verify(llm, times(2)).complete(anyString(), anyList(), any(), any(), anyBoolean());
    }
    @Test
    void aProposeCall_marksTheAnswerWithTheAction_andTheReplyStillComesFromTheModel() {
        LlmReply.ToolCall propose = new LlmReply.ToolCall("call_9", "propose_check_in", "{}");
        when(llm.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new LlmReply("", 1, 1, 0, List.of(propose))));
        when(tools.run("propose_check_in", ME)).thenReturn("Proposed.");
        when(llm.complete(anyString(), anyList(), any(), any(), eq(false)))
                .thenReturn(Optional.of(new LlmReply("Tap Yes to check in.", 1, 1, 0)));

        AssistantService.Answer answer = service.answerWithAction(ask("Check me in"), ME, "en");

        assertThat(answer.reply()).isEqualTo("Tap Yes to check in.");
        assertThat(answer.action().name()).isEqualTo("checkInToday");
    }

    @Test
    void aReadToolCall_hasNoAction() {
        when(llm.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new LlmReply("", 1, 1, 0, List.of(CALL))));
        when(tools.run(anyString(), any())).thenReturn("nothing");
        when(llm.complete(anyString(), anyList(), any(), any(), eq(false)))
                .thenReturn(Optional.of(new LlmReply("Nobody is waiting.", 1, 1, 0)));

        assertThat(service.answerWithAction(ask("Who is waiting?"), ME, "en").action()).isNull();
    }
}
