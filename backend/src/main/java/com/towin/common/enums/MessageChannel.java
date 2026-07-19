package com.towin.common.enums;

/**
 * Which conversation a message belongs to within a connection.
 * MAIN is the private elder-helper chat; FAMILY_UPDATES is the shared
 * updates thread family members can read on shared connections.
 */
public enum MessageChannel {
    MAIN, FAMILY_UPDATES
}
