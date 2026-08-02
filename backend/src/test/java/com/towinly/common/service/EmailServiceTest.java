package com.towinly.common.service;

import com.sun.net.httpserver.HttpServer;
import com.towinly.common.seed.DemoDataSeeder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.lang.reflect.Field;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class EmailServiceTest {

    /**
     * A stand-in for Brevo that answers 201 and counts what it was asked to send.
     * The count is the assertion that matters for the demo-address guard: a
     * refusal has to mean no request was made at all, not a request that failed.
     */
    private static final class RecordingBrevo implements AutoCloseable {
        private final HttpServer server;
        private final AtomicInteger requests = new AtomicInteger();

        private RecordingBrevo() throws IOException {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                requests.incrementAndGet();
                exchange.sendResponseHeaders(201, -1);
                exchange.close();
            });
            server.start();
        }

        static RecordingBrevo start() throws IOException {
            return new RecordingBrevo();
        }

        String baseUrl() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }

        int requestCount() {
            return requests.get();
        }

        EmailService clientPointedAtMe() {
            return new EmailService("key", "no-reply@towin.app", "Towinly", baseUrl());
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }

    // Digs the request factory out of the RestClient so we can prove the timeouts
    // are actually wired in. RestClient exposes no getter for it, hence reflection.
    private static Object requestFactoryOf(EmailService service) throws Exception {
        Field brevoField = EmailService.class.getDeclaredField("brevo");
        brevoField.setAccessible(true);
        RestClient brevo = (RestClient) brevoField.get(service);

        Field factoryField = brevo.getClass().getDeclaredField("clientRequestFactory");
        factoryField.setAccessible(true);
        return factoryField.get(brevo);
    }

    private static int timeoutField(Object factory, String name) throws Exception {
        Field field = SimpleClientHttpRequestFactory.class.getDeclaredField(name);
        field.setAccessible(true);
        return (int) field.get(factory);
    }

    @Test
    void brevoClientIsBuiltWithBoundedConnectAndReadTimeouts() throws Exception {
        EmailService service = new EmailService("key", "no-reply@towin.app", "Towinly");

        Object factory = requestFactoryOf(service);

        assertThat(factory).isInstanceOf(SimpleClientHttpRequestFactory.class);
        // Bounded: a hung Brevo call must never park a request thread forever.
        assertThat(timeoutField(factory, "connectTimeout")).isGreaterThan(0).isLessThanOrEqualTo(30_000);
        assertThat(timeoutField(factory, "readTimeout")).isGreaterThan(0).isLessThanOrEqualTo(30_000);
    }

    @Test
    @Timeout(value = 30, unit = TimeUnit.SECONDS)
    void sendReturnsAndSwallowsTheErrorWhenBrevoHangs() throws Exception {
        // A Brevo that accepts the connection and then never answers. Without a read
        // timeout the send parks this thread forever; with one it gives up and logs.
        try (ServerSocket stalledBrevo = new ServerSocket(0)) {
            EmailService service = new EmailService(
                    "key", "no-reply@towin.app", "Towinly",
                    "http://127.0.0.1:" + stalledBrevo.getLocalPort());

            assertDoesNotThrow(() ->
                    service.sendVerificationEmail("elder@towin.app", "https://towin.app/verify?t=abc"));
        }
    }

    @Test
    @Timeout(value = 30, unit = TimeUnit.SECONDS)
    void sendSwallowsTheErrorWhenBrevoIsUnreachable() throws Exception {
        // Nothing listening on this port — the send must still not break signup.
        int deadPort;
        try (ServerSocket probe = new ServerSocket(0)) {
            deadPort = probe.getLocalPort();
        }
        EmailService service = new EmailService(
                "key", "no-reply@towin.app", "Towinly", "http://127.0.0.1:" + deadPort);

        assertDoesNotThrow(() ->
                service.sendPasswordResetEmail("elder@towin.app", "https://towin.app/reset?t=abc"));
    }

    @Test
    void verificationAndResetNeverReachADemoMailbox() throws Exception {
        // elder@gmail.com and helper@gmail.com are real, deliverable mailboxes
        // belonging to people who are not users, and the demo logins ship in the
        // frontend bundle. Nothing we send may ever land in them.
        try (RecordingBrevo brevo = RecordingBrevo.start()) {
            EmailService service = brevo.clientPointedAtMe();

            service.sendVerificationEmail(DemoDataSeeder.ELDER_DEMO_EMAIL, "https://towin.app/verify?t=abc");
            service.sendPasswordResetEmail(DemoDataSeeder.HELPER_DEMO_EMAIL, "https://towin.app/reset?t=abc");

            assertThat(brevo.requestCount()).isZero();
        }
    }

    @Test
    void refusesDemoAddresses() throws Exception {
        try (RecordingBrevo brevo = RecordingBrevo.start()) {
            EmailService service = brevo.clientPointedAtMe();

            for (String demo : DemoDataSeeder.DEMO_EMAILS) {
                assertThat(service.send(demo, "x", "y")).isFalse();
            }

            // A refusal means nothing was attempted, not that an attempt failed.
            assertThat(brevo.requestCount()).isZero();
        }
    }

    @Test
    void refusesADemoAddressWhateverTheCasingOrSpacing() throws Exception {
        try (RecordingBrevo brevo = RecordingBrevo.start()) {
            EmailService service = brevo.clientPointedAtMe();

            assertThat(service.send("  Elder@Gmail.Com ", "x", "y")).isFalse();

            assertThat(brevo.requestCount()).isZero();
        }
    }

    @Test
    void stillSendsToARealAddress() throws Exception {
        // The guard must be narrow: ordinary members keep getting their mail.
        try (RecordingBrevo brevo = RecordingBrevo.start()) {
            EmailService service = brevo.clientPointedAtMe();

            assertThat(service.send("margaret@example.com", "x", "y")).isTrue();

            assertThat(brevo.requestCount()).isEqualTo(1);
        }
    }

    @Test
    void unconfiguredServiceLogsLinkInsteadOfSending() {
        // No API key: the link is logged, nothing is sent, nothing is thrown.
        EmailService service = new EmailService("", "", "Towinly");

        assertDoesNotThrow(() -> service.sendVerificationEmail("elder@towin.app", "https://towin.app/verify?t=abc"));
        assertDoesNotThrow(() -> service.sendPasswordResetEmail("elder@towin.app", "https://towin.app/reset?t=abc"));
    }
}
