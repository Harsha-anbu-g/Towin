package com.towin.common.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.lang.reflect.Field;
import java.net.ServerSocket;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

class EmailServiceTest {

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
        EmailService service = new EmailService("key", "no-reply@towin.app", "ToWin");

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
                    "key", "no-reply@towin.app", "ToWin",
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
                "key", "no-reply@towin.app", "ToWin", "http://127.0.0.1:" + deadPort);

        assertDoesNotThrow(() ->
                service.sendPasswordResetEmail("elder@towin.app", "https://towin.app/reset?t=abc"));
    }

    @Test
    void unconfiguredServiceLogsLinkInsteadOfSending() {
        // No API key: the link is logged, nothing is sent, nothing is thrown.
        EmailService service = new EmailService("", "", "ToWin");

        assertDoesNotThrow(() -> service.sendVerificationEmail("elder@towin.app", "https://towin.app/verify?t=abc"));
        assertDoesNotThrow(() -> service.sendPasswordResetEmail("elder@towin.app", "https://towin.app/reset?t=abc"));
    }
}
