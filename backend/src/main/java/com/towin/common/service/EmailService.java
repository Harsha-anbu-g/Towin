package com.towin.common.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
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

    private final RestClient brevo = RestClient.builder()
            .baseUrl("https://api.brevo.com/v3")
            .build();

    private final String apiKey;
    private final String fromEmail;
    private final String fromName;
    private final boolean configured;

    public EmailService(@Value("${app.mail.brevo-api-key:}") String apiKey,
                        @Value("${app.mail.from:}") String fromEmail,
                        @Value("${app.mail.from-name:ToWin}") String fromName) {
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
}
