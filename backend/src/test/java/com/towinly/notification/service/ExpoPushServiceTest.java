package com.towinly.notification.service;

import com.sun.net.httpserver.HttpServer;
import com.towinly.common.entity.User;
import com.towinly.notification.entity.PushToken;
import com.towinly.notification.repository.PushTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@Timeout(value = 10, unit = TimeUnit.SECONDS)
class ExpoPushServiceTest {

    /** A stand-in for Expo that answers a scripted ticket body and counts calls. */
    private static final class RecordingExpo implements AutoCloseable {
        private final HttpServer server;
        private final AtomicInteger requests = new AtomicInteger();
        private volatile String responseBody = "{\"data\":[{\"status\":\"ok\",\"id\":\"t1\"}]}";

        private RecordingExpo() throws IOException {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                requests.incrementAndGet();
                byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                try (OutputStream out = exchange.getResponseBody()) { out.write(body); }
            });
            server.start();
        }

        static RecordingExpo start() throws IOException { return new RecordingExpo(); }

        String baseUrl() { return "http://127.0.0.1:" + server.getAddress().getPort(); }

        int requestCount() { return requests.get(); }

        @Override public void close() { server.stop(0); }
    }

    private static PushToken tokenRow(String token) {
        return PushToken.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(UUID.randomUUID()).build())
                .token(token)
                .platform("ios")
                .updatedAt(LocalDateTime.now())
                .build();
    }

    /** Wait for the single background sender thread to drain. */
    private static void drain(RecordingExpo expo, int expected) throws InterruptedException {
        for (int i = 0; i < 100 && expo.requestCount() < expected; i++) {
            Thread.sleep(50);
        }
    }

    @Test
    void aUserWithNoTokensCausesNoRequestAtAll() throws Exception {
        try (RecordingExpo expo = RecordingExpo.start()) {
            PushTokenRepository repo = mock(PushTokenRepository.class);
            when(repo.findAllByUserId(any())).thenReturn(List.of());
            ExpoPushService service = new ExpoPushService(repo, expo.baseUrl());

            service.sendToUser(UUID.randomUUID(), "Maria", "sent you a message.", Map.of("type", "message"));

            Thread.sleep(200);
            assertThat(expo.requestCount()).isZero();
        }
    }

    @Test
    void aRegisteredDeviceGetsExactlyOnePost() throws Exception {
        try (RecordingExpo expo = RecordingExpo.start()) {
            PushTokenRepository repo = mock(PushTokenRepository.class);
            when(repo.findAllByUserId(any()))
                    .thenReturn(List.of(tokenRow("ExponentPushToken[abc]")));
            ExpoPushService service = new ExpoPushService(repo, expo.baseUrl());

            service.sendToUser(UUID.randomUUID(), "Maria", "sent you a message.", Map.of("type", "message"));

            drain(expo, 1);
            assertThat(expo.requestCount()).isEqualTo(1);
            verify(repo, never()).delete(any());
        }
    }

    @Test
    void aDeviceNotRegisteredTicketDropsTheDeadToken() throws Exception {
        try (RecordingExpo expo = RecordingExpo.start()) {
            expo.responseBody = "{\"data\":[{\"status\":\"error\",\"message\":\"gone\","
                    + "\"details\":{\"error\":\"DeviceNotRegistered\"}}]}";
            PushTokenRepository repo = mock(PushTokenRepository.class);
            PushToken dead = tokenRow("ExponentPushToken[dead]");
            when(repo.findAllByUserId(any())).thenReturn(List.of(dead));
            when(repo.findByToken("ExponentPushToken[dead]")).thenReturn(java.util.Optional.of(dead));
            ExpoPushService service = new ExpoPushService(repo, expo.baseUrl());

            service.sendToUser(UUID.randomUUID(), "Maria", "sent you a message.", Map.of("type", "message"));

            drain(expo, 1);
            verify(repo, timeout(2000)).delete(dead);
        }
    }

    @Test
    void anUnreachableExpoNeverThrowsIntoTheCaller() {
        PushTokenRepository repo = mock(PushTokenRepository.class);
        when(repo.findAllByUserId(any()))
                .thenReturn(List.of(tokenRow("ExponentPushToken[abc]")));
        // Port 9 is discard; the connect fails fast. The send must stay silent.
        ExpoPushService service = new ExpoPushService(repo, "http://127.0.0.1:9");

        assertDoesNotThrow(() ->
                service.sendToUser(UUID.randomUUID(), "Maria", "sent you a message.", Map.of()));
    }

    @Test
    void aBrokenTokenLookupIsSwallowedNotThrown() {
        PushTokenRepository repo = mock(PushTokenRepository.class);
        when(repo.findAllByUserId(any())).thenThrow(new RuntimeException("db down"));
        ExpoPushService service = new ExpoPushService(repo, "http://127.0.0.1:9");

        assertDoesNotThrow(() ->
                service.sendToUser(UUID.randomUUID(), "Maria", "sent you a message.", Map.of()));
    }
}
