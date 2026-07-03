package com.towin.common.exception;

import com.towin.common.dto.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final Map<String, String> SAFE_MESSAGES;
    static {
        SAFE_MESSAGES = new HashMap<>();
        SAFE_MESSAGES.put("User not found",                               "Invalid request.");
        SAFE_MESSAGES.put("Invalid request.",                             "Invalid request.");
        SAFE_MESSAGES.put("Email already registered",                     "Email already registered.");
        SAFE_MESSAGES.put("Username already taken",                       "Username already taken. Please choose another.");
        SAFE_MESSAGES.put("Invalid or expired verification link.",        "Invalid or expired verification link.");
        SAFE_MESSAGES.put("This verification link has expired.",          "This verification link has expired. Please sign up again.");
        SAFE_MESSAGES.put("Invalid or expired reset link.",              "Invalid or expired reset link.");
        SAFE_MESSAGES.put("This reset link has expired.",                "This reset link has expired. Request a new one.");
        SAFE_MESSAGES.put("Invalid or expired code.",                     "Invalid or expired code.");
        SAFE_MESSAGES.put("Too many attempts.",                           "Too many attempts. Try again in 15 minutes.");
        SAFE_MESSAGES.put("Verification code has expired.",               "Verification code has expired. Request a new one.");
        SAFE_MESSAGES.put("Invalid credentials",                          "Invalid credentials.");
        SAFE_MESSAGES.put("Email already registered",                     "Email already registered.");
        SAFE_MESSAGES.put("Phone already registered",                     "Phone already registered.");
        SAFE_MESSAGES.put("Guest role must be",                           "Invalid request.");
        // OAuth-specific messages
        SAFE_MESSAGES.put("Session expired. Please sign in with Google",  "Your session expired. Please sign in with Google again.");
        SAFE_MESSAGES.put("Invalid onboarding session.",                  "Your session expired. Please sign in with Google again.");
        SAFE_MESSAGES.put("Username already taken.",                      "Username already taken. Please choose another.");
        SAFE_MESSAGES.put("This phone number is already registered.",     "This phone number is already registered.");
        SAFE_MESSAGES.put("Role must be ELDER or HELPER",                 "Please select a valid role (Elder or Helper).");
        SAFE_MESSAGES.put("Username must be",                             "Username must be 3-20 characters: lowercase letters, numbers, underscores only.");
        SAFE_MESSAGES.put("Username already",                             "Username already taken. Please choose another.");
        // Change-password flow
        SAFE_MESSAGES.put("Current password is incorrect.",               "Current password is incorrect.");
        SAFE_MESSAGES.put("New password must be different",               "New password must be different from your current password.");
        SAFE_MESSAGES.put("Please choose a stronger password",            "Please choose a stronger password — that one is too common or easy to guess.");
        SAFE_MESSAGES.put("Password must be at least 8 characters",       "Password must be at least 8 characters.");
        SAFE_MESSAGES.put("This account uses Google sign-in",             "This account uses Google sign-in, so it has no password to change.");
        // Connection flow
        SAFE_MESSAGES.put("A connection already exists",                  "You already have a pending or active connection with this person.");
        SAFE_MESSAGES.put("Cannot send a connection request to yourself", "You can't send a friend request to yourself.");
        SAFE_MESSAGES.put("Daily connection request limit reached",       "You've sent too many friend requests today. Try again tomorrow.");
        SAFE_MESSAGES.put("HELPER connection limit reached",              "This helper has reached their connection limit.");
        SAFE_MESSAGES.put("ELDER connection limit reached",               "You've reached your connection limit. End an existing connection first.");
        SAFE_MESSAGES.put("BOTH connection limit reached",                "You've reached your connection limit. End an existing connection first.");
        SAFE_MESSAGES.put("You are not part of this connection",          "You are not part of this connection.");
        SAFE_MESSAGES.put("Initiator cannot respond",                     "You can't respond to your own request.");
        SAFE_MESSAGES.put("Connection is not pending",                    "This request is no longer pending.");
        SAFE_MESSAGES.put("Only active connections can be ended",         "Only active connections can be ended.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("IllegalArgumentException: {}", ex.getMessage());
        String safe = SAFE_MESSAGES.entrySet().stream()
                .filter(e -> ex.getMessage() != null && ex.getMessage().startsWith(e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse("Invalid request.");
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(safe, 400, LocalDateTime.now()));
    }

    @ExceptionHandler(RateLimitException.class)
    public ResponseEntity<ErrorResponse> handleRateLimit(RateLimitException ex) {
        log.warn("RateLimitException: {}", ex.getMessage());
        return ResponseEntity.status(429)
                .body(new ErrorResponse(ex.getMessage(), 429, LocalDateTime.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(message, 400, LocalDateTime.now()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex) {
        // Business-rule / authorization-state guards (e.g. "Not a participant",
        // "Can only message an active connection") — a 409, not an opaque 500.
        log.warn("IllegalStateException: {}", ex.getMessage());
        String msg = ex.getMessage() != null ? ex.getMessage() : "That action isn't allowed right now.";
        return ResponseEntity.status(409)
                .body(new ErrorResponse(msg, 409, LocalDateTime.now()));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException ex) {
        String msg = ex.getMessage() != null && ex.getMessage().contains("phone")
                ? "That phone number is already in use by another account."
                : "A duplicate value already exists.";
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(msg, 400, LocalDateTime.now()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex) {
        // Log the real cause server-side, but never echo internal exception text
        // (stack-trace fragments, SQL, NPE messages) back to the client.
        log.error("Unhandled RuntimeException", ex);
        return ResponseEntity.status(500)
                .body(new ErrorResponse("Something went wrong. Please try again.", 500, LocalDateTime.now()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.internalServerError()
                .body(new ErrorResponse("Something went wrong. Please try again.", 500, LocalDateTime.now()));
    }
}
