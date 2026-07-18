package com.towin.common.enums;

/**
 * Types of in-app family alerts (family_alerts.type is VARCHAR(20); stored as name()).
 * In-app only — family members never get email or SMS (user decision, US-007).
 */
public enum FamilyAlertType {
    SOS,
    FIRST_MEET,
    INACTIVITY
}
