package com.towin.common.enums;

/**
 * Guardian mode (2026-07-19): a specific power an elder may delegate to ONE
 * trusted family member, letting them act on the elder's behalf. Every
 * delegated action is attributed "&lt;family member&gt;, for &lt;elder&gt;" — never
 * silent impersonation. The elder grants and revokes each power; a family
 * member can never grant themselves anything.
 */
public enum DelegatedPower {
    /** Send messages in the elder's own chats with their helpers. */
    MESSAGE_HELPERS,
    /** Post and close the elder's help requests. */
    MANAGE_HELP_REQUESTS,
    /** Move the trust ladder forward on the elder's seat. */
    ADVANCE_TRUST,
    /** Leave a review of a helper as the elder (most sensitive — feeds trust score). */
    LEAVE_REVIEWS
}
