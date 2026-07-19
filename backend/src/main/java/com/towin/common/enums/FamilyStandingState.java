package com.towin.common.enums;

/**
 * The family member's stance on an inherited standing. Absence of a control
 * row means the standing is active; PAUSED blocks new messages both ways but
 * keeps history; REVOKED removes the standing and ends any materialized
 * FAMILY connection.
 */
public enum FamilyStandingState {
    PAUSED, REVOKED
}
