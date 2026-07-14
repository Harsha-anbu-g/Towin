package com.towin.common.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Sends transactional email through Brevo's HTTPS API. We use the API (not SMTP)
 * because Railway — like most cloud hosts — blocks outbound SMTP ports, so a
 * normal mail server can never connect. When no API key is configured (local
 * dev) it logs the link instead of sending, so the app still works offline.
 * A send failure is logged but never thrown — it must not break signup.
 */
@Slf4j
@Service
public class EmailService {

    // Bounded timeouts, as in GroqClient and GeocodingService: a send happens
    // inside the signup request, so a hung Brevo call would park a Tomcat thread
    // indefinitely. Read is roomier than geocoding's 3s (mail is not latency
    // critical) but still far short of holding a thread open.
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 10000;

    private final RestClient brevo;

    private final String apiKey;
    private final String fromEmail;
    private final String fromName;
    private final boolean configured;

    // Spring constructor. @Autowired disambiguates it from the package-private
    // test constructor below.
    @Autowired
    public EmailService(@Value("${app.mail.brevo-api-key:}") String apiKey,
                        @Value("${app.mail.from:}") String fromEmail,
                        @Value("${app.mail.from-name:ToWin}") String fromName) {
        this(apiKey, fromEmail, fromName, "https://api.brevo.com/v3");
    }

    // Test constructor: point the client at a local stub instead of the real Brevo.
    EmailService(String apiKey, String fromEmail, String fromName, String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        this.brevo = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
        this.fromName = fromName;
        this.configured = apiKey != null && !apiKey.isBlank()
                && fromEmail != null && !fromEmail.isBlank();
    }

    public void sendVerificationEmail(String to, String verifyLink) {
        if (!configured) {
            // Dev convenience: no API key configured, so surface the link in logs.
            log.info("Mail not configured — verification link for {}: {}", to, verifyLink);
            return;
        }
        try {
            Map<String, Object> body = Map.of(
                "sender", Map.of("name", fromName, "email", fromEmail),
                "to", List.of(Map.of("email", to)),
                "subject", "Verify your ToWin email",
                "textContent",
                    "Welcome to ToWin!\n\n" +
                    "Please confirm your email by opening this link:\n" +
                    verifyLink + "\n\n" +
                    "This link expires in 24 hours. If you didn't sign up, you can ignore this email."
            );
            brevo.post()
                    .uri("/smtp/email")
                    .header("api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Verification email sent");
        } catch (Exception e) {
            // A mail outage must never fail the signup — the account is created and
            // the user can request a fresh link later via "resend". Log and move on.
            log.error("Failed to send verification email: {}", e.getMessage());
        }
    }

    public void sendPasswordResetEmail(String to, String resetLink) {
        if (!configured) {
            log.info("Mail not configured — password reset link for {}: {}", to, resetLink);
            return;
        }
        try {
            Map<String, Object> body = Map.of(
                "sender", Map.of("name", fromName, "email", fromEmail),
                "to", List.of(Map.of("email", to)),
                "subject", "Reset your ToWin password",
                "textContent",
                    "We received a request to reset your ToWin password.\n\n" +
                    "Open this link to choose a new password:\n" +
                    resetLink + "\n\n" +
                    "This link expires in 1 hour. If you didn't request this, you can ignore this email."
            );
            brevo.post()
                    .uri("/smtp/email")
                    .header("api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Password reset email sent");
        } catch (Exception e) {
            log.error("Failed to send password reset email: {}", e.getMessage());
        }
    }
}
