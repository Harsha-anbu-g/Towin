package com.towinly.common.enums;

/**
 * Types of in-app family alerts (family_alerts.type is VARCHAR(20); stored as name()).
 * In-app only — family members never get email or SMS (user decision, US-007).
 */
public enum FamilyAlertType {
    SOS,
    FIRST_MEET,
    INACTIVITY,

    /**
     * The elder has asked somebody to hold a key to her Sealed box.
     *
     * The three below are loud on purpose, and their silence elsewhere is just as
     * deliberate. Nothing in this app stops a relative sitting beside an elder and tapping
     * through the whole setup for her; what these do is make sure the rest of the family
     * see it happen. Taking a key back has no alert at all — see
     * {@code KeyholderService.remove}.
     */
    KEYHOLDER_ASKED,

    /** The elder set her Sealed box up, or changed how many Keyholders must agree. */
    SEALED_BOX_SET,

    /**
     * The box was opened soon after this account's password changed. Whoever holds an
     * elder's mailbox can reset her password, so the family are told when a reveal follows
     * one closely — the seven-day freeze blocks the first week, and this covers the rest of
     * the month behind it.
     */
    SEALED_BOX_OPENED
}
