package com.towin.common.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends transactional email via the configured SMTP server. When no SMTP
 * credentials are set (local dev) it logs the link instead of sending, so the
 * app still works without a mail server — mirrors the Twilio "not configured"
 * pattern in SosService.
 */
@Slf4j
@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final String from;
    private final boolean configured;

    public EmailService(JavaMailSender mailSender,
                        @Value("${app.mail.from:}") String from,
                        @Value("${spring.mail.username:}") String username) {
        this.mailSender = mailSender;
        this.from = (from == null || from.isBlank()) ? username : from;
        this.configured = username != null && !username.isBlank();
    }

    public void sendVerificationEmail(String to, String verifyLink) {
        if (!configured) {
            // Dev convenience: no SMTP configured, so surface the link in logs.
            log.info("Mail not configured — verification link for {}: {}", to, verifyLink);
            return;
        }
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject("Verify your ToWin email");
            msg.setText(
                "Welcome to ToWin!\n\n" +
                "Please confirm your email by opening this link:\n" +
                verifyLink + "\n\n" +
                "This link expires in 24 hours. If you didn't sign up, you can ignore this email."
            );
            mailSender.send(msg);
            log.info("Verification email sent");
        } catch (Exception e) {
            // A mail outage must never fail the signup — the account is created and
            // the user can request a fresh link later via "resend". Log and move on.
            log.error("Failed to send verification email: {}", e.getMessage());
        }
    }
}
