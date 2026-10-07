package com.towinly.common.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class IdempotencyFilterTest {

    private final UUID userId = UUID.randomUUID();
    private IdempotencyStore store;
    private IdempotencyFilter filter;
    private AtomicInteger executions;
    private AtomicReference<String> bodySeenByController;

    @BeforeEach
    void setUp() {
        store = mock(IdempotencyStore.class);
        filter = new IdempotencyFilter(store, new ObjectMapper().findAndRegisterModules());
        executions = new AtomicInteger();
        bodySeenByController = new AtomicReference<>();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                userId.toString(), null, List.of(new SimpleGrantedAuthority("ELDER"))));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void firstAttemptRunsAndItsSuccessIsSaved() throws Exception {
        when(store.claim(eq(userId), eq("key-123456"), anyString())).thenReturn(new IdempotencyStore.Started());

        MockHttpServletResponse response = run(send("key-123456", "{\"content\":\"Thank you\"}"), 201);

        assertThat(executions.get()).isEqualTo(1);
        assertThat(response.getStatus()).isEqualTo(201);
        assertThat(response.getContentAsString()).isEqualTo("{\"id\":\"m1\"}");
        // The controller still reads the body after the filter fingerprinted it.
        assertThat(bodySeenByController.get()).isEqualTo("{\"content\":\"Thank you\"}");
        verify(store).complete(eq(userId), eq("key-123456"), eq(201), any(), any());
        verify(store, never()).release(any(), any());
    }

    @Test
    void aRetryWithTheSameKeyGetsTheFirstAnswerWithoutRunningAgain() throws Exception {
        when(store.claim(eq(userId), eq("key-123456"), anyString())).thenReturn(new IdempotencyStore.Replay(
                201, "application/json", "{\"id\":\"m1\"}".getBytes(StandardCharsets.UTF_8)));

        MockHttpServletResponse response = run(send("key-123456", "{\"content\":\"Thank you\"}"), 201);

        assertThat(executions.get()).isZero();
        assertThat(response.getStatus()).isEqualTo(201);
        assertThat(response.getContentAsString()).isEqualTo("{\"id\":\"m1\"}");
        assertThat(response.getHeader(IdempotencyFilter.REPLAYED_HEADER)).isEqualTo("true");
    }

    @Test
    void aFailedAttemptIsReleasedSoTheRetryRunsAgain() throws Exception {
        when(store.claim(eq(userId), eq("key-123456"), anyString())).thenReturn(new IdempotencyStore.Started());

        run(send("key-123456", "{}"), 409);

        verify(store).release(userId, "key-123456");
        verify(store, never()).complete(any(), any(), anyInt(), any(), any());
    }

    @Test
    void aRetryWhileTheFirstIsStillRunningIsToldToWait() throws Exception {
        when(store.claim(eq(userId), eq("key-123456"), anyString())).thenReturn(new IdempotencyStore.InProgress());

        MockHttpServletResponse response = run(send("key-123456", "{}"), 201);

        assertThat(executions.get()).isZero();
        assertThat(response.getStatus()).isEqualTo(409);
    }

    @Test
    void theSameKeyOnADifferentRequestIsRefused() throws Exception {
        when(store.claim(eq(userId), eq("key-123456"), anyString())).thenReturn(new IdempotencyStore.Mismatch());

        MockHttpServletResponse response = run(send("key-123456", "{}"), 201);

        assertThat(executions.get()).isZero();
        assertThat(response.getStatus()).isEqualTo(422);
    }

    @Test
    void aDifferentBodyGivesADifferentFingerprint() throws Exception {
        AtomicReference<String> first = new AtomicReference<>();
        when(store.claim(eq(userId), eq("key-123456"), anyString())).thenAnswer(inv -> {
            first.compareAndSet(null, inv.getArgument(2));
            return new IdempotencyStore.Started();
        });
        run(send("key-123456", "{\"content\":\"a\"}"), 201);
        String hashA = first.get();
        first.set(null);
        run(send("key-123456", "{\"content\":\"b\"}"), 201);

        assertThat(first.get()).isNotEqualTo(hashA);
    }

    @Test
    void withoutTheHeaderNothingChanges() throws Exception {
        MockHttpServletRequest request = send(null, "{}");

        run(request, 201);

        assertThat(executions.get()).isEqualTo(1);
        verifyNoInteractions(store);
    }

    @Test
    void readsAreNeverTouched() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/messages/abc");
        request.addHeader(IdempotencyFilter.HEADER, "key-123456");

        run(request, 200);

        verifyNoInteractions(store);
    }

    @Test
    void sealedBoxAndSignInAnswersAreNeverStored() throws Exception {
        for (String path : List.of("/api/passon/sealed/abc/reveal", "/api/auth/login")) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
            request.addHeader(IdempotencyFilter.HEADER, "key-123456");
            request.setContent("{}".getBytes(StandardCharsets.UTF_8));
            run(request, 200);
        }
        verifyNoInteractions(store);
    }

    @Test
    void signedOutRequestsPassThrough() throws Exception {
        SecurityContextHolder.clearContext();

        run(send("key-123456", "{}"), 201);

        assertThat(executions.get()).isEqualTo(1);
        verifyNoInteractions(store);
    }

    @Test
    void aMalformedKeyIsRejected() throws Exception {
        MockHttpServletResponse response = run(send("short", "{}"), 201);

        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(executions.get()).isZero();
        verifyNoInteractions(store);
    }

    private MockHttpServletRequest send(String key, String body) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/messages/abc/send");
        request.setContentType("application/json");
        request.setContent(body.getBytes(StandardCharsets.UTF_8));
        if (key != null) request.addHeader(IdempotencyFilter.HEADER, key);
        return request;
    }

    private MockHttpServletResponse run(MockHttpServletRequest request, int status) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        HttpServlet controller = new HttpServlet() {
            @Override
            protected void service(HttpServletRequest req, HttpServletResponse res) throws IOException {
                executions.incrementAndGet();
                bodySeenByController.set(new String(req.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
                res.setStatus(status);
                res.setContentType("application/json");
                res.getOutputStream().write("{\"id\":\"m1\"}".getBytes(StandardCharsets.UTF_8));
            }
        };
        filter.doFilter(request, response, new MockFilterChain(controller));
        return response;
    }
}
