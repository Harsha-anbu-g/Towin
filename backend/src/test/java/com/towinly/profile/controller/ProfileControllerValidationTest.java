package com.towinly.profile.controller;

import com.towinly.block.service.BlockService;
import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.common.service.S3Service;
import com.towinly.profile.service.ProfileService;
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
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProfileControllerValidationTest {

    @Mock
    private ProfileService profileService;

    @Mock
    private S3Service s3Service;

    @InjectMocks
    private ProfileController controller;

    private MockMvc mockMvc;
    private Authentication auth;
    private UUID userId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        userId = UUID.randomUUID();
        auth = new UsernamePasswordAuthenticationToken(userId.toString(), null);
    }

    @Test
    @DisplayName("returns 400, not 500, when latitude is a string instead of a number")
    void rejectsNonNumericLatitude() throws Exception {
        mockMvc.perform(put("/api/profile/location")
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"locationLat\":\"north\",\"locationLng\":77.6}"))
                .andExpect(status().isBadRequest());

        verify(profileService, never()).updateLocation(any(), any(), any(), any());
    }

    @Test
    @DisplayName("returns 400 when latitude is outside the valid range")
    void rejectsOutOfRangeLatitude() throws Exception {
        mockMvc.perform(put("/api/profile/location")
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"locationLat\":120.0,\"locationLng\":77.6}"))
                .andExpect(status().isBadRequest());

        verify(profileService, never()).updateLocation(any(), any(), any(), any());
    }

    @Test
    @DisplayName("saves a valid numeric latitude and longitude")
    void savesValidCoordinates() throws Exception {
        mockMvc.perform(put("/api/profile/location")
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"locationLat\":12.97,\"locationLng\":77.59,\"city\":\"Bengaluru\"}"))
                .andExpect(status().isOk());

        verify(profileService).updateLocation(eq(userId), eq(12.97), eq(77.59), eq("Bengaluru"));
    }

    @Test
    @DisplayName("still accepts a body with no latitude or longitude")
    void acceptsNullCoordinates() throws Exception {
        mockMvc.perform(put("/api/profile/location")
                        .principal(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"city\":\"Bengaluru\"}"))
                .andExpect(status().isOk());

        verify(profileService).updateLocation(eq(userId), isNull(), isNull(), eq("Bengaluru"));
    }

    // ── SEC-06: the endpoint has to say who is asking ────────────────────────

    @Test
    @DisplayName("names the caller as the viewer when reading someone else's profile")
    void passesTheCallerAsTheViewerOfAnotherProfile() throws Exception {
        UUID otherId = UUID.randomUUID();

        mockMvc.perform(get("/api/profile/" + otherId).principal(auth))
                .andExpect(status().isOk());

        verify(profileService).getProfile(eq(otherId), eq(userId));
    }

    @Test
    @DisplayName("names the owner as their own viewer, so /profile/{id} on yourself is still a self view")
    void passesTheOwnerAsTheirOwnViewer() throws Exception {
        mockMvc.perform(get("/api/profile/" + userId).principal(auth))
                .andExpect(status().isOk());

        verify(profileService).getProfile(eq(userId), eq(userId));
    }

    // ── R2-PROF: a blocked read comes out as the refusal every other block gate uses ──

    @Test
    @DisplayName("a blocked profile read is a 409 carrying the words the rest of the app uses")
    void aBlockedProfileReadIsRefusedWithTheSharedSentence() throws Exception {
        UUID otherId = UUID.randomUUID();
        when(profileService.getProfile(eq(otherId), eq(userId)))
                .thenThrow(new IllegalStateException(BlockService.NOT_AVAILABLE));

        // This is what both clients actually receive, so it is worth pinning at the edge
        // rather than only at the service: a 409 and a sentence that names no block.
        mockMvc.perform(get("/api/profile/" + otherId).principal(auth))
                .andExpect(status().isConflict())
                .andExpect(content().string(containsString(BlockService.NOT_AVAILABLE)));
    }
}
