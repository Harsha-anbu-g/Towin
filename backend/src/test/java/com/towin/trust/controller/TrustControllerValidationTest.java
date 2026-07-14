package com.towin.trust.controller;

import com.towin.common.exception.GlobalExceptionHandler;
import com.towin.common.service.TrustScoreService;
import com.towin.trust.dto.TrustActionRequest;
import com.towin.trust.service.TrustService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrustControllerValidationTest {

    @Mock
    private TrustService trustService;

    @Mock
    private TrustScoreService trustScoreService;

    @InjectMocks
    private TrustController controller;

    private MockMvc mockMvc;
    private Authentication auth;
    private UUID userId;
    private UUID connectionId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        userId = UUID.randomUUID();
        connectionId = UUID.randomUUID();
        auth = new UsernamePasswordAuthenticationToken(userId.toString(), null);
    }

    @Test
    @DisplayName("rejects a trust note longer than the allowed limit")
    void rejectsOverLongNote() throws Exception {
        String tooLong = "x".repeat(1001);
        String body = "{\"note\":\"" + tooLong + "\"}";

        mockMvc.perform(post("/api/trust/{connectionId}/confirm", connectionId)
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        verify(trustService, never()).confirmTrustLevel(any(), any(), any());
    }

    @Test
    @DisplayName("accepts a trust note within the allowed limit")
    void acceptsNoteWithinLimit() throws Exception {
        mockMvc.perform(post("/api/trust/{connectionId}/confirm", connectionId)
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"Happy to move forward.\"}"))
                .andExpect(status().isOk());

        verify(trustService).confirmTrustLevel(eq(userId), eq(connectionId), any(TrustActionRequest.class));
    }

    @Test
    @DisplayName("still accepts a confirm with no request body at all")
    void acceptsMissingBody() throws Exception {
        mockMvc.perform(post("/api/trust/{connectionId}/confirm", connectionId)
                        .principal(auth))
                .andExpect(status().isOk());

        verify(trustService).confirmTrustLevel(eq(userId), eq(connectionId), isNull());
    }
}
