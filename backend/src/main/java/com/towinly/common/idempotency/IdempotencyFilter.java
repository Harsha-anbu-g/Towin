package com.towinly.common.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.towinly.common.dto.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Makes every signed-in write safe to retry.
 *
 * A client that sends {@code Idempotency-Key: <random id>} on a POST, PUT, PATCH or
 * DELETE gets exactly one execution per key: a retry with the same key and the same
 * request receives the first attempt's answer (with {@code Idempotent-Replayed: true})
 * instead of running again. This is what stops a lost reply from turning one message,
 * one help request, one review or one SOS into two.
 *
 * Requests without the header behave exactly as before, so app builds already on
 * people's phones keep working. Only successful answers (2xx) are kept: a request
 * that failed changed nothing, so its retry simply runs again.
 */
@Component
@RequiredArgsConstructor
public class IdempotencyFilter extends OncePerRequestFilter {

    public static final String HEADER = "Idempotency-Key";
    public static final String REPLAYED_HEADER = "Idempotent-Replayed";

    /** Random ids from the clients: UUIDs or similar, never free text. */
    private static final Pattern KEY_FORMAT = Pattern.compile("^[A-Za-z0-9_-]{8,100}$");
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    /** Bodies above this are uploads, not the small JSON writes this protects. */
    private static final int MAX_BODY_BYTES = 256 * 1024;

    /**
     * Never stored, whatever the client sends. Sign-in answers carry tokens; the
     * Sealed box answers carry decrypted letters, which must never sit in a second
     * table in the clear; the assistant is open to signed-out visitors.
     */
    private static final List<String> EXCLUDED = List.of(
            "/api/auth/**",
            "/oauth2/**",
            "/login/oauth2/**",
            "/api/passon/sealed/**",
            "/api/assistant/**");

    private static final AntPathMatcher PATHS = new AntPathMatcher();
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(IdempotencyFilter.class);

    private final IdempotencyStore store;
    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!WRITE_METHODS.contains(request.getMethod())) return true;
        if (request.getHeader(HEADER) == null) return true;
        String contentType = request.getContentType();
        if (contentType != null && contentType.toLowerCase().startsWith("multipart/")) return true;
        if (request.getContentLengthLong() > MAX_BODY_BYTES) return true;
        String path = request.getRequestURI();
        return EXCLUDED.stream().anyMatch(p -> PATHS.match(p, path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        UUID userId = signedInUser();
        if (userId == null) {
            chain.doFilter(request, response);
            return;
        }
        String key = request.getHeader(HEADER).trim();
        if (!KEY_FORMAT.matcher(key).matches()) {
            writeError(response, 400, "That request had an invalid Idempotency-Key.");
            return;
        }

        CachedBodyRequest cached = new CachedBodyRequest(request);
        String hash = fingerprint(request, cached.body());

        IdempotencyStore.Claim claim = store.claim(userId, key, hash);
        if (claim instanceof IdempotencyStore.Replay replay) {
            response.setStatus(replay.status());
            if (replay.contentType() != null) response.setContentType(replay.contentType());
            response.setHeader(REPLAYED_HEADER, "true");
            if (replay.body() != null) response.getOutputStream().write(replay.body());
            return;
        }
        if (claim instanceof IdempotencyStore.InProgress) {
            writeError(response, 409, "That request is still being processed. Please try again in a moment.");
            return;
        }
        if (claim instanceof IdempotencyStore.Mismatch) {
            writeError(response, 422, "That Idempotency-Key was already used for a different request.");
            return;
        }

        ContentCachingResponseWrapper captured = new ContentCachingResponseWrapper(response);
        boolean saved = false;
        try {
            chain.doFilter(cached, captured);
            int status = captured.getStatus();
            if (status >= 200 && status < 300) {
                // The write already happened. If saving the answer fails, keep the
                // claim rather than releasing it: a retry then waits (409) instead of
                // running the write a second time.
                saved = true;
                try {
                    store.complete(userId, key, status, captured.getContentType(), captured.getContentAsByteArray());
                } catch (RuntimeException e) {
                    log.warn("Could not save the answer for idempotency key on {} {}: {}",
                            request.getMethod(), request.getRequestURI(), e.getMessage());
                }
            }
        } finally {
            if (!saved) store.release(userId, key);
            captured.copyBodyToResponse();
        }
    }

    private static UUID signedInUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return null;
        }
        try {
            return UUID.fromString(auth.getName());
        } catch (IllegalArgumentException notAUserId) {
            return null;
        }
    }

    /** Method, path, query and body: the same key on a different request is refused. */
    private static String fingerprint(HttpServletRequest request, byte[] body) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(request.getMethod().getBytes(StandardCharsets.UTF_8));
            sha.update((byte) ' ');
            sha.update(request.getRequestURI().getBytes(StandardCharsets.UTF_8));
            if (request.getQueryString() != null) {
                sha.update((byte) '?');
                sha.update(request.getQueryString().getBytes(StandardCharsets.UTF_8));
            }
            sha.update((byte) '\n');
            sha.update(body);
            return HexFormat.of().formatHex(sha.digest());
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is always available", impossible);
        }
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getOutputStream(),
                new ErrorResponse(message, status, LocalDateTime.now()));
    }

    /** Reads the body once so it can be both fingerprinted and handed to the controller. */
    static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        CachedBodyRequest(HttpServletRequest request) throws IOException {
            super(request);
            this.body = request.getInputStream().readAllBytes();
        }

        byte[] body() {
            return body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream in = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public boolean isFinished() { return in.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException("Synchronous reads only");
                }
                @Override public int read() { return in.read(); }
                @Override public int read(byte[] b, int off, int len) { return in.read(b, off, len); }
            };
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding() != null ? getCharacterEncoding() : "UTF-8";
            return new BufferedReader(new InputStreamReader(getInputStream(), java.nio.charset.Charset.forName(encoding)));
        }
    }
}
