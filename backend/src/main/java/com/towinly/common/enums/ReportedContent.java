package com.towinly.common.enums;

/**
 * What one particular thing a report is about, when it is about a thing and not only a person.
 *
 * Reports were user-to-user for the whole of the app's life before "What I pass on", and most
 * still are — a report with no content reference is normal and stays legal. This exists because
 * a living person named in an elder's story has to be able to say <em>which story</em>, and
 * "this person wrote something upsetting somewhere" is not something an admin can act on.
 */
public enum ReportedContent {

    /** A story or a letter on somebody's "What I pass on" page. */
    PASSON_ITEM
}
