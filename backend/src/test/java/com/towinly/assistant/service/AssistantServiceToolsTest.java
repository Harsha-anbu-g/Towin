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
    private static final GroqReply.ToolCall CALL = new GroqReply.ToolCall("call_1", "get_my_connections", "{}");

    private GroqClient groq;
    private AssistantTools tools;
    private AssistantSpend spend;
    private AssistantService service;

    @BeforeEach
    void setUp() {
        groq = mock(GroqClient.class);
        when(groq.isConfigured()).thenReturn(true);
        tools = mock(AssistantTools.class);
        spend = mock(AssistantSpend.class);
        service = new AssistantService(groq,
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
        when(groq.complete(anyString(), anyList())).thenReturn(Optional.of(new GroqReply("Hi.", 1, 1, 0)));

        assertThat(service.answer(ask("Hello"), null, "en")).isEqualTo("Hi.");

        verify(groq).complete(anyString(), anyList());
        verify(groq, never()).complete(anyString(), anyList(), any(), any(), anyBoolean());
    }

    @Test
    void aSignedInPerson_isOfferedTheThreeTools_withAutoChoice() {
        when(groq.complete(anyString(), anyList(), any(), any(), anyBoolean()))
                .thenReturn(Optional.of(new GroqReply("Your score is 12.", 10, 5, 0)));

        assertThat(service.answer(ask("What is my score?"), ME, "en")).isEqualTo("Your score is 12.");

        verify(groq).complete(anyString(), anyList(), eq(AssistantTools.DEFINITIONS), eq("auto"), eq(true));
        verify(tools, never()).run(anyString(), any());
        verify(spend).record(any(), eq("en"), eq(ME), anyLong());
    }

    @SuppressWarnings("unchecked")
    @Test
    void aToolCall_isRun_andTheSecondCallGetsTheResult_withNoMoreTools() {
        when(groq.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new GroqReply("", 4000, 20, 3800, List.of(CALL))));
        when(tools.run("get_my_connections", ME)).thenReturn("- Rita (Helper): active, at Phone Ready.");
        when(groq.complete(anyString(), anyList(), any(), eq("none"), eq(false)))
                .thenReturn(Optional.of(new GroqReply("Rita is at Phone Ready.", 4300, 90, 4000)));

        String reply = service.answer(ask("Where is Rita?"), ME, "en");

        assertThat(reply).isEqualTo("Rita is at Phone Ready.");
        ArgumentCaptor<List<Map<String, Object>>> second = ArgumentCaptor.forClass(List.class);
        verify(groq).complete(anyString(), second.capture(), eq(AssistantTools.DEFINITIONS), eq("none"), eq(false));
        List<Map<String, Object>> turns = second.getValue();
        assertThat(turns.get(turns.size() - 2)).containsEntry("role", "assistant").containsKey("tool_calls");
        assertThat(turns.get(turns.size() - 1)).containsEntry("role", "tool")
                .containsEntry("tool_call_id", "call_1")
                .containsEntry("content", "- Rita (Helper): active, at Phone Ready.");

        ArgumentCaptor<GroqReply> booked = ArgumentCaptor.forClass(GroqReply.class);
        verify(spend).record(booked.capture(), eq("en"), eq(ME), anyLong());
        assertThat(booked.getValue().promptTokens()).isEqualTo(8300);
        assertThat(booked.getValue().completionTokens()).isEqualTo(110);
    }

    @Test
    void ifTheSecondCallFails_theFirstIsStillBooked_andTheFallbackIsSaid() {
        when(groq.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new GroqReply("", 4000, 20, 0, List.of(CALL))));
        when(tools.run(anyString(), any())).thenReturn("No connections yet.");
        when(groq.complete(anyString(), anyList(), any(), eq("none"), eq(false))).thenReturn(Optional.empty());

        assertThat(service.answer(ask("Who is waiting?"), ME, "en")).startsWith("Sorry");

        ArgumentCaptor<GroqReply> booked = ArgumentCaptor.forClass(GroqReply.class);
        verify(spend).record(booked.capture(), eq("en"), eq(ME), anyLong());
        assertThat(booked.getValue().totalTokens()).isEqualTo(4020);
    }

    @Test
    void severalToolCalls_inOneReply_areAllRun() {
        GroqReply.ToolCall fam = new GroqReply.ToolCall("call_2", "get_my_family", "{}");
        when(groq.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new GroqReply("", 1, 1, 0, List.of(CALL, fam))));
        when(tools.run(anyString(), any())).thenReturn("nothing");
        when(groq.complete(anyString(), anyList(), any(), eq("none"), eq(false)))
                .thenReturn(Optional.of(new GroqReply("Done.", 1, 1, 0)));

        service.answer(ask("Everything?"), ME, "en");

        verify(tools).run("get_my_connections", ME);
        verify(tools).run("get_my_family", ME);
        verify(groq, times(2)).complete(anyString(), anyList(), any(), any(), anyBoolean());
    }
    @Test
    void aProposeCall_marksTheAnswerWithTheAction_andTheReplyStillComesFromTheModel() {
        GroqReply.ToolCall propose = new GroqReply.ToolCall("call_9", "propose_check_in", "{}");
        when(groq.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new GroqReply("", 1, 1, 0, List.of(propose))));
        when(tools.run("propose_check_in", ME)).thenReturn("Proposed.");
        when(groq.complete(anyString(), anyList(), any(), eq("none"), eq(false)))
                .thenReturn(Optional.of(new GroqReply("Tap Yes to check in.", 1, 1, 0)));

        AssistantService.Answer answer = service.answerWithAction(ask("Check me in"), ME, "en");

        assertThat(answer.reply()).isEqualTo("Tap Yes to check in.");
        assertThat(answer.action().name()).isEqualTo("check_in");
    }

    @Test
    void aReadToolCall_hasNoAction() {
        when(groq.complete(anyString(), anyList(), any(), eq("auto"), eq(true)))
                .thenReturn(Optional.of(new GroqReply("", 1, 1, 0, List.of(CALL))));
        when(tools.run(anyString(), any())).thenReturn("nothing");
        when(groq.complete(anyString(), anyList(), any(), eq("none"), eq(false)))
                .thenReturn(Optional.of(new GroqReply("Nobody is waiting.", 1, 1, 0)));

        assertThat(service.answerWithAction(ask("Who is waiting?"), ME, "en").action()).isNull();
    }
}
