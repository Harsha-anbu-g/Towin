package com.towin.common.enums;

public enum ConnectionType {
    SOCIAL, SERVICE,
    /** Family member ↔ helper (Step 4): coordination-only — never earns trust
     *  points and never counts toward connection limits. */
    FAMILY
}
