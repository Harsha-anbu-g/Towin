package com.towinly.common.enums;

/**
 * Who the elder said may read something. Never the answer to "may this person read it" —
 * that is re-derived on every read by PassOnVisibilityService, never stored.
 */
public enum PassOnAudience {
    EVERYONE, FAMILY, HELPERS, PERSON
}
