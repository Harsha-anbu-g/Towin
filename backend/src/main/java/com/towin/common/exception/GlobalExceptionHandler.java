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
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final Map<String, String> SAFE_MESSAGES = Map.of(
        "User not found",                    "Invalid request.",
        "Invalid request.",                  "Invalid request.",
        "Invalid or expired code.",          "Invalid or expired code.",
        "Too many attempts.",                "Too many attempts. Try again in 15 minutes.",
        "Verification code has expired.",    "Verification code has expired. Request a new one.",
        "Invalid credentials",               "Invalid credentials.",
        "Email already registered",          "Email already registered.",
        "Phone already registered",          "Phone already registered.",
        "Guest role must be",                "Invalid request.",
        "Verification code has expired. Request a new one.", "Verification code has expired. Request a new one."
    );

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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.internalServerError()
                .body(new ErrorResponse("Something went wrong. Please try again.", 500, LocalDateTime.now()));
    }
}
