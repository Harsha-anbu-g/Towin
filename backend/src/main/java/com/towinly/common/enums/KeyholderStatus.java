package com.towinly.common.enums;

/**
 * INVITED -> ACTIVE | DECLINED, then ACTIVE -> RESIGNED | REMOVED | ENDED.
 *
 * ENDED is set when the underlying family link is revoked, so an elder never has to
 * understand two different "remove this person" buttons with two different consequences.
 */
public enum KeyholderStatus {
    INVITED, ACTIVE, DECLINED, RESIGNED, REMOVED, ENDED
}
