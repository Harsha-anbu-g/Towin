package com.towinly.notification.service;

import com.towinly.notification.entity.PushToken;
import com.towinly.notification.repository.PushTokenRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * The single door a phone ping leaves Towinly through. Expo's push API turns
 * an ExponentPushToken into an APNs (or FCM) delivery, needs no API key, and
 * is called over HTTPS, which is the one outbound route Railway allows
 * (CLAUDE.md: all SMTP is blocked, Brevo went HTTPS for the same reason).
 *
 * Sends are fire-and-forget on a single background thread: a user's message
 * must never wait on Apple, and a push failure must never fail the action that
 * caused it. When the send runs inside a transaction it is deferred to commit,
 * so a rolled-back message can never ping a phone.
 */
@Slf4j
@Service
public class ExpoPushService {

    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 10000;
    /** Expo rejects requests above 100 messages; sends are chunked to obey. */
    private static final int EXPO_MAX_PER_REQUEST = 100;
    /** Longest title a lock screen needs. Everything past it is not a name. */
    private static final int MAX_TITLE_LENGTH = 40;
    private static final java.util.regex.Pattern URLISH = java.util.regex.Pattern.compile(
            "(?i)(https?:|www\\.|\\b[a-z0-9-]+\\.(com|net|org|info|io|co|ca|in|xyz|me)\\b)");

    private final PushTokenRepository pushTokenRepository;
    private final RestClient expo;
    private final ExecutorService sender = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "expo-push");
        t.setDaemon(true);
        return t;
    });

    @Autowired
    public ExpoPushService(PushTokenRepository pushTokenRepository) {
        this(pushTokenRepository, "https://exp.host");
    }

    // Test constructor: point the client at a local stub instead of Expo.
    ExpoPushService(PushTokenRepository pushTokenRepository, String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        this.expo = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.pushTokenRepository = pushTokenRepository;
    }

    /**
     * The lock-screen guard. Every push title is a user-chosen display name,
     * and a lock screen renders it under Towinly's trusted app identity with
     * no report button and no context. A profile named "CALL +1-900-555-0123
     * to claim your refund" must never reach an elder's lock screen, and that
     * exact scam is why this exists (2026-08-16 security review, HIGH). A name
     * that smells like a URL or carries a phone number's worth of digits
     * becomes "Someone"; control characters go; length is capped.
     */
    static String safeTitle(String raw) {
        if (raw == null) return "Someone";
        String cleaned = raw
                .replaceAll("[\\p{Cntrl}\\p{Cf}]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (cleaned.isEmpty()) return "Someone";
        boolean urlish = URLISH.matcher(cleaned).find();
        boolean phoneish = cleaned.replaceAll("[^0-9]", "").length() >= 7;
        if (urlish || phoneish) return "Someone";
        if (cleaned.length() > MAX_TITLE_LENGTH) {
            return cleaned.substring(0, MAX_TITLE_LENGTH - 1).trim() + "…";
        }
        return cleaned;
    }

    /**
     * Ping every device this user is signed in on. Title and body are the
     * words on the lock screen; data rides underneath and tells the app which
     * screen to open on tap. The title passes the lock-screen guard above;
     * bodies are fixed sentences owned by the callers, never user text.
     */
    public void sendToUser(UUID userId, String title, String body, Map<String, Object> data) {
        // Token lookup happens on the caller's thread, inside its transaction,
        // where lazy loading is safe. Only the HTTP leaves the request path.
        List<String> tokens;
        try {
            tokens = pushTokenRepository.findAllByUserId(userId).stream()
                    .map(PushToken::getToken)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Push token lookup failed for {}", userId, e);
            return;
        }
        if (tokens.isEmpty()) return;

        String guardedTitle = safeTitle(title);
        List<Map<String, Object>> messages = tokens.stream()
                .map(token -> Map.<String, Object>of(
                        "to", token,
                        "title", guardedTitle,
                        "body", body,
                        "sound", "default",
                        "data", data))
                .collect(Collectors.toList());

        Runnable dispatch = () -> sender.submit(() -> post(messages, tokens));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            // Inside a transaction: ping only after it commits. A message that
            // rolls back must never light up a phone.
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { dispatch.run(); }
            });
        } else {
            dispatch.run();
        }
    }

    private void post(List<Map<String, Object>> messages, List<String> tokens) {
        // Expo caps a request at 100 messages. The per-user token cap keeps
        // real traffic far below this; the chunking keeps the contract honest
        // even if it is ever exceeded.
        for (int start = 0; start < messages.size(); start += EXPO_MAX_PER_REQUEST) {
            int end = Math.min(start + EXPO_MAX_PER_REQUEST, messages.size());
            postChunk(messages.subList(start, end), tokens.subList(start, end));
        }
    }

    @SuppressWarnings("unchecked")
    private void postChunk(List<Map<String, Object>> messages, List<String> tokens) {
        try {
            Map<String, Object> response = expo.post()
                    .uri("/--/api/v2/push/send")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(messages)
                    .retrieve()
                    .body(Map.class);
            // Expo answers one ticket per message, in order. The only ticket
            // worth acting on is DeviceNotRegistered: that token is dead (app
            // deleted, permission revoked) and keeping it would mean posting
            // to Expo forever for a phone that will never ring again.
            Object dataField = response == null ? null : response.get("data");
            if (!(dataField instanceof List)) return;
            List<Map<String, Object>> tickets = (List<Map<String, Object>>) dataField;
            for (int i = 0; i < tickets.size() && i < tokens.size(); i++) {
                Map<String, Object> ticket = tickets.get(i);
                if (!"error".equals(ticket.get("status"))) continue;
                Object details = ticket.get("details");
                Object errorCode = details instanceof Map ? ((Map<String, Object>) details).get("error") : null;
                log.warn("Expo push ticket error for token index {}: {} ({})", i, ticket.get("message"), errorCode);
                if ("DeviceNotRegistered".equals(errorCode)) {
                    deleteToken(tokens.get(i));
                }
            }
        } catch (Exception e) {
            // Fire-and-forget by design: log and move on, never rethrow.
            log.warn("Expo push send failed for {} message(s)", messages.size(), e);
        }
    }

    private void deleteToken(String token) {
        try {
            pushTokenRepository.findByToken(token).ifPresent(pushTokenRepository::delete);
        } catch (Exception e) {
            log.warn("Failed to drop dead push token", e);
        }
    }

    @PreDestroy
    void shutdown() {
        sender.shutdown();
    }
}
