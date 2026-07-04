package com.towin.assistant.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/** Ask AI's answer for the frontend chat panel. */
@Data
@AllArgsConstructor
public class ChatResponse {
    private String reply;
}
