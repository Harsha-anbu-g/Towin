package com.towinly.passon.exception;

/**
 * Thrown when one particular sealed row will not open: the authentication tag did not
 * verify. The box itself is fine — this row is not.
 *
 * In practice that means the row was edited or moved. Because the additional authenticated
 * data binds owner id, item id and key version, a blob transplanted from another owner or
 * another item lands here rather than quietly decrypting under the wrong name. Treat every
 * occurrence as a security event, not a glitch.
 *
 * Extends IllegalStateException so the existing handler maps it to HTTP 409 with the
 * message passed through unchanged.
 */
public class SealedItemUnreadableException extends IllegalStateException {

    /**
     * Everything the reader is told. Plain words in the voice the rest of the app already
     * uses ("We couldn't find that person"), and no mechanism: naming the cause would tell
     * whoever moved the row exactly which check caught them.
     */
    public static final String MESSAGE = "We couldn't open this one.";

    public SealedItemUnreadableException(String message) {
        super(message);
    }
}
