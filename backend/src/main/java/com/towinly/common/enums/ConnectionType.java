package com.towinly.common.enums;

public enum ConnectionType {
    SOCIAL, SERVICE,
    /** Family member ↔ helper (Step 4): coordination-only — never earns trust
     *  points and never counts toward connection limits. */
    FAMILY,
    /** Elder ↔ elder or helper ↔ helper: friends who just chat. Accepting the
     *  request opens the chat; there is no trust ladder to climb, no Trust Score
     *  points, no reviews, no help requests, no phone number and no slot used. */
    PEER;

    /**
     * True for the elder–helper friendships that the Trust Score, reviews, the
     * connection limit and every unlock (phone, socials, letters, family standings)
     * are about. Null reads as the column default, SOCIAL.
     */
    public static boolean earnsTrust(ConnectionType type) {
        return type == null || type == SOCIAL || type == SERVICE;
    }

    public static boolean isPeer(ConnectionType type) {
        return type == PEER;
    }
}
