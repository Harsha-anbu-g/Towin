package com.towinly.passon.exception;

/**
 * Thrown when the Sealed box cannot be operated at all — no master key configured, a key
 * that fails the startup self-check, or a row wrapped by a key version this build does not
 * hold.
 *
 * The message is the whole point: it is shown to the elder unchanged, so it says only that
 * the box is unavailable right now. Never put the reason in it. The reason is logged
 * server-side; telling a visitor which of "no key", "bad key" or "wrong key version" it was
 * hands an attacker the state of our key management for free.
 *
 * Mapped to HTTP 503 by GlobalExceptionHandler. A refusal is deliberate and is always
 * better than the alternative: creating rows nobody will ever be able to decrypt.
 */
public class SealedBoxUnavailableException extends RuntimeException {

    /** The only thing an elder is ever told. Plain words, no mechanism, no blame. */
    public static final String MESSAGE = "The Sealed box is temporarily unavailable";

    public SealedBoxUnavailableException(String message) {
        super(message);
    }
}
