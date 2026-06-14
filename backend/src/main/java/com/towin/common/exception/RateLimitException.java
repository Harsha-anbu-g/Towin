package com.towin.common.exception;

/**
 * Thrown when a client exceeds an allowed request rate (login brute-force or
 * per-IP auth flooding). Mapped to HTTP 429 by GlobalExceptionHandler.
 */
public class RateLimitException extends RuntimeException {
    public RateLimitException(String message) {
        super(message);
    }
}
