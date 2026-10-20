package com.towinly.assistant.dto;

import com.towinly.assistant.service.AssistantService;
import lombok.AllArgsConstructor;
import lombok.Data;

/** Ask AI's answer for the chat panel: the words, and the one action the app may ask to confirm. */
@Data
@AllArgsConstructor
public class ChatResponse {
    private String reply;
    /** The proposed action ({name, arguments}) the app should ask to confirm; null when nothing was proposed. */
    private AssistantService.Action action;

    public ChatResponse(String reply) {
        this(reply, null);
    }
}
