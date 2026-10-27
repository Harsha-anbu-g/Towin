package com.towinly.assistant.service;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** A proposal call becomes one app action: the function's name, and only the arguments it allows, made safe. */
class AssistantActionsTest {

    private static LlmReply.ToolCall call(String tool, String json) {
        return new LlmReply.ToolCall("c1", tool, json);
    }

    @Test
    void checkIn_isTheAppFunction_withNoArguments() {
        Optional<AssistantService.Action> a = AssistantActions.toAction(call("propose_check_in", "{}"));
        assertThat(a).isPresent();
        assertThat(a.get().name()).isEqualTo("checkInToday");
        assertThat(a.get().arguments()).isEmpty();
    }

    @Test
    void helpRequest_keepsOnlyTheAllowedKeys_andNeverOnBehalfOf() {
        Optional<AssistantService.Action> a = AssistantActions.toAction(call("propose_help_request",
                "{\"title\":\"A lift on Thursday\",\"description\":\"To the clinic at 9\",\"category\":\"TRANSPORTATION\","
                + "\"urgency\":\"NORMAL\",\"onBehalfOfElderId\":\"123\",\"evil\":true}"));
        assertThat(a.get().name()).isEqualTo("postHelpRequest");
        assertThat(a.get().arguments()).containsOnlyKeys("title", "description", "category", "urgency")
                .containsEntry("title", "A lift on Thursday").containsEntry("category", "TRANSPORTATION");
    }

    @Test
    void helpRequest_sanitizesAndCapsStrings_andDefaultsBadEnums() {
        String longTitle = "x".repeat(300);
        Optional<AssistantService.Action> a = AssistantActions.toAction(call("propose_help_request",
                "{\"title\":\"" + longTitle + "\\u200B\",\"category\":\"SPACESHIP\",\"urgency\":\"NOW\"}"));
        Map<String, Object> args = a.get().arguments();
        assertThat(((String) args.get("title")).length()).isEqualTo(200);
        assertThat(args).containsEntry("category", "OTHER").containsEntry("urgency", "NORMAL");
        assertThat(args.get("description")).isNull();
    }

    @Test
    void helpRequest_withoutATitle_isNoAction() {
        assertThat(AssistantActions.toAction(call("propose_help_request", "{\"category\":\"ERRANDS\"}"))).isEmpty();
        assertThat(AssistantActions.toAction(call("propose_help_request", "not json"))).isEmpty();
    }

    @Test
    void aReadTool_isNoAction() {
        assertThat(AssistantActions.isProposal("get_my_family")).isFalse();
        assertThat(AssistantActions.toAction(call("get_my_family", "{}"))).isEmpty();
    }
}
