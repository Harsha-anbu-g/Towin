package com.towinly.assistant.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * The body cap has to hold before the JSON is parsed — that is the whole point of
 * it, since the DTO's own size limits only apply to an object that already exists
 * on the heap.
 */
class AssistantRequestSizeFilterTest {

    private AssistantRequestSizeFilter filter;
    private MockHttpServletResponse response;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new AssistantRequestSizeFilter();
        response = new MockHttpServletResponse();
        chain = mock(FilterChain.class);
    }

    private MockHttpServletRequest chatRequest(byte[] body, boolean declareLength) {
        // A real chunked request reports no content length. MockHttpServletRequest
        // always derives one from the content, so that case is reproduced by
        // overriding the accessor the filter actually consults.
        MockHttpServletRequest request = declareLength
                ? new MockHttpServletRequest("POST", "/api/assistant/chat")
                : new MockHttpServletRequest("POST", "/api/assistant/chat") {
                    @Override public long getContentLengthLong() { return -1; }
                    @Override public int getContentLength() { return -1; }
                };
        request.setRequestURI("/api/assistant/chat");
        request.setContentType("application/json");
        request.setContent(body);
        if (!declareLength) {
            request.addHeader("Transfer-Encoding", "chunked");
        }
        return request;
    }

    private static byte[] bodyOf(int bytes) {
        return ("{\"message\":\"" + "z".repeat(bytes) + "\"}").getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void anOversizedBody_isRefusedBeforeTheRequestIsEvenParsed() throws Exception {
        MockHttpServletRequest request = chatRequest(bodyOf(AssistantRequestSizeFilter.MAX_BODY_BYTES + 1), true);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentAsString()).contains("too long for me to read");
        verify(chain, never()).doFilter(any(), any()); // never reached the parser
    }

    @Test
    void aNormalSizedBody_passesStraightThrough() throws Exception {
        MockHttpServletRequest request = chatRequest(bodyOf(500), true);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        verify(chain).doFilter(any(), any());
    }

    @Test
    void aBodyReadPastTheCap_isCutOff() throws Exception {
        // Nothing to check up front on a chunked request, so the guard has to hold
        // while the stream is being read rather than only at the door.
        MockHttpServletRequest request = chatRequest(bodyOf(AssistantRequestSizeFilter.MAX_BODY_BYTES + 1), false);

        filter.doFilter(request, response, chain);

        ArgumentCaptor<ServletRequest> wrapped = ArgumentCaptor.forClass(ServletRequest.class);
        verify(chain).doFilter(wrapped.capture(), any());

        assertThatThrownBy(() -> wrapped.getValue().getInputStream().readAllBytes())
                .isInstanceOf(IOException.class)
                .hasMessageContaining("exceeds");
    }

    @Test
    void otherEndpoints_areLeftAlone() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRequestURI("/api/auth/login");

        assertThat(filter.shouldNotFilter(request)).isTrue();
    }

    @Test
    void theAssistantEndpoint_isCovered() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/assistant/chat");
        request.setRequestURI("/api/assistant/chat");

        assertThat(filter.shouldNotFilter(request)).isFalse();
    }
}
