package com.towinly.discovery.controller;

import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.discovery.dto.DiscoveryFilter;
import com.towinly.discovery.service.DiscoveryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SEC-07: the clamp has to hold on the real request, not only on a hand-built filter.
 * These go through the query string exactly as the scraping request did.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DiscoveryControllerLimitsTest {

    @Mock
    private DiscoveryService discoveryService;

    @InjectMocks
    private DiscoveryController controller;

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
        when(discoveryService.discoverElders(any(), any())).thenReturn(List.of());
        when(discoveryService.discoverHelpers(any(), any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("the directory-scraping query string reaches the service already clamped")
    void clampsTheSizeAndRadiusItBindsFromTheQueryString() throws Exception {
        mockMvc.perform(get("/api/discover/elders")
                        .param("size", "100000")
                        .param("radiusKm", "100000")
                        .principal(auth))
                .andExpect(status().isOk());

        DiscoveryFilter bound = capturedElderFilter();
        assertThat(bound.getSize()).isEqualTo(50);
        assertThat(bound.getRadiusKm()).isEqualTo(100.0);
    }

    @Test
    @DisplayName("the helper directory is clamped by the same query string")
    void clampsTheHelperRouteToo() throws Exception {
        mockMvc.perform(get("/api/discover/helpers")
                        .param("size", "100000")
                        .principal(auth))
                .andExpect(status().isOk());

        ArgumentCaptor<DiscoveryFilter> captor = ArgumentCaptor.forClass(DiscoveryFilter.class);
        verify(discoveryService).discoverHelpers(eq(userId), captor.capture());
        assertThat(captor.getValue().getSize()).isEqualTo(50);
    }

    @Test
    @DisplayName("an empty radius answers normally instead of a server error")
    void answersAnEmptyRadiusWithTheDefault() throws Exception {
        mockMvc.perform(get("/api/discover/elders")
                        .param("radiusKm", "")
                        .principal(auth))
                .andExpect(status().isOk());

        assertThat(capturedElderFilter().getRadiusKm()).isEqualTo(10.0);
    }

    @Test
    @DisplayName("an ordinary request is passed through untouched")
    void leavesAnOrdinaryRequestAlone() throws Exception {
        mockMvc.perform(get("/api/discover/elders")
                        .param("radiusKm", "25")
                        .param("size", "20")
                        .principal(auth))
                .andExpect(status().isOk());

        DiscoveryFilter bound = capturedElderFilter();
        assertThat(bound.getSize()).isEqualTo(20);
        assertThat(bound.getRadiusKm()).isEqualTo(25.0);
    }

    private DiscoveryFilter capturedElderFilter() {
        ArgumentCaptor<DiscoveryFilter> captor = ArgumentCaptor.forClass(DiscoveryFilter.class);
        verify(discoveryService).discoverElders(eq(userId), captor.capture());
        return captor.getValue();
    }
}
