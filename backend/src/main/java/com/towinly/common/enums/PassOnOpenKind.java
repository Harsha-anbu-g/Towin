package com.towinly.common.enums;

/** What happened, for the record the elder can read back. */
public enum PassOnOpenKind {
    CREATED,
    OPENED_BY_OWNER,
    DELETED,
    KEYHOLDER_ACCEPTED,
    KEYHOLDER_RESIGNED,
    BOX_ARMED,
    SETTINGS_CHANGED,
    MANUAL_RELEASE
}
