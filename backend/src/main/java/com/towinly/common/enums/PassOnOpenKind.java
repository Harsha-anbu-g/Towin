package com.towinly.common.enums;

/** What happened, for the record the elder can read back. */
public enum PassOnOpenKind {
    CREATED,
    OPENED_BY_OWNER,
    DELETED,
    KEYHOLDER_ACCEPTED,
    KEYHOLDER_RESIGNED,
    /**
     * Somebody stopped holding a key because they came off the elder's family list, not
     * because either of them decided anything about the box.
     *
     * Not in the design's own list of kinds, and added rather than folded into
     * KEYHOLDER_RESIGNED: a daughter who unlinked her account did not resign a duty, and an
     * elder reading her record back would be told something that did not happen. The column
     * is VARCHAR(24) with no CHECK constraint, so this needs no migration.
     */
    KEYHOLDER_ENDED,
    BOX_ARMED,
    SETTINGS_CHANGED,
    MANUAL_RELEASE
}
