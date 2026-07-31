package com.towinly.passon.dto;

import com.towinly.common.enums.SealedKind;

/**
 * One sealed item, opened. The only shape in this package that carries a body.
 *
 * It is returned from exactly one method, behind the account password and behind the
 * seven-day freeze, to the owner and to nobody else. Never log it, never cache it, and never
 * put it in a list.
 */
public record SealedRevealResponse(java.util.UUID id,
                                   SealedKind kindHint,
                                   String label,
                                   String body) {
}
