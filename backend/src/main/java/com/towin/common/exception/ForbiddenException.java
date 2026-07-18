package com.towin.common.exception;

/**
 * Thrown when an authenticated user attempts an action their role or position
 * does not permit (e.g. a helper flipping the elder-only family-visibility
 * switch). Mapped to HTTP 403 by GlobalExceptionHandler.
 */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
