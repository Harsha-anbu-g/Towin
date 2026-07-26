package com.towinly.common.enums;

/**
 * Lifecycle of a family member's ask for a delegated power. PENDING is the only
 * live state; APPROVED and DECLINED are history — they never authorize anything
 * (the grant lives in family_delegated_powers) but their respondedAt throttles
 * how soon the same power can be asked for again.
 */
public enum PowerRequestStatus {
    PENDING,
    APPROVED,
    DECLINED
}
