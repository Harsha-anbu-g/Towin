package com.towinly.assistant.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

/**
 * Refuses an oversized body on the Ask AI endpoint before anything reads it.
 *
 * <p>The size caps on {@link com.towinly.assistant.dto.ChatRequest} cannot do this
 * job. Bean Validation runs on an object, so the JSON has to be parsed into one
 * first — a 23MB request is fully materialised on the heap and only then rejected
 * as "conversation is too long". That costs the attacker one HTTP call and costs us
 * the memory, which on a small instance is the whole attack: repeat it in parallel
 * and the process dies without a single model call being made.
 *
 * <p>Jackson's own 20MB-per-string ceiling does not cover it either, because that
 * limit is per string and a legal request may carry a dozen of them.
 *
 * <p>So the length is checked at the door. {@code Content-Length} covers the normal
 * case; a chunked request declares no length, so its stream is wrapped and cut off
 * at the same ceiling rather than trusted. The cap is far above any genuine
 * conversation — the DTO's own limits allow roughly 50k characters, and multi-byte
 * text at worst quadruples that — and far below anything that threatens the heap.
 */
@Slf4j
@Component
public class AssistantRequestSizeFilter extends OncePerRequestFilter {

    /** Generous next to a real conversation, small next to the heap. */
    static final int MAX_BODY_BYTES = 256 * 1024;

    private static final String PATH_PREFIX = "/api/assistant/";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (request.getContentLengthLong() > MAX_BODY_BYTES) {
            log.warn("Ask AI: refused an oversized body ({} bytes) from {}",
                    request.getContentLengthLong(), request.getRemoteAddr());
            writeTooLarge(response);
            return;
        }
        // A chunked request declares no length, so it is only bounded as it is read.
        chain.doFilter(new LimitedBodyRequest(request), response);
    }

    /** Mirrors the shape of {@link com.towinly.common.dto.ErrorResponse} by hand — no controller ran. */
    private void writeTooLarge(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader(HttpHeaders.CONNECTION, "close");
        response.getWriter().write(String.format(
                "{\"message\":\"That message is too long for me to read. "
                        + "Please shorten it and try again.\",\"status\":%d,\"timestamp\":\"%s\"}",
                HttpStatus.PAYLOAD_TOO_LARGE.value(), LocalDateTime.now()));
    }

    /**
     * Wraps the body so a request that declares no length still cannot stream an
     * unbounded amount in. Overshooting throws, which Spring surfaces as an
     * unreadable body — a 400 with the friendly wording already in
     * {@link com.towinly.common.exception.GlobalExceptionHandler}.
     */
    private static final class LimitedBodyRequest extends HttpServletRequestWrapper {

        private LimitedBodyRequest(HttpServletRequest request) {
            super(request);
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            ServletInputStream delegate = super.getInputStream();
            return new ServletInputStream() {
                private long read;

                private int countAndCheck(int bytes) throws IOException {
                    if (bytes > 0 && (read += bytes) > MAX_BODY_BYTES) {
                        throw new IOException("Request body exceeds " + MAX_BODY_BYTES + " bytes");
                    }
                    return bytes;
                }

                @Override
                public int read() throws IOException {
                    int b = delegate.read();
                    countAndCheck(b < 0 ? 0 : 1);
                    return b;
                }

                @Override
                public int read(byte[] b, int off, int len) throws IOException {
                    return countAndCheck(delegate.read(b, off, len));
                }

                @Override public boolean isFinished() { return delegate.isFinished(); }
                @Override public boolean isReady() { return delegate.isReady(); }
                @Override public void setReadListener(ReadListener listener) { delegate.setReadListener(listener); }
                @Override public int available() throws IOException { return delegate.available(); }
                @Override public void close() throws IOException { delegate.close(); }
            };
        }

        /** Kept consistent with {@link #getInputStream()} so either access path is bounded. */
        @Override
        public BufferedReader getReader() throws IOException {
            String encoding = getCharacterEncoding();
            return new BufferedReader(new InputStreamReader(getInputStream(),
                    encoding != null ? encoding : StandardCharsets.UTF_8.name()));
        }
    }
}
