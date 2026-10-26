package com.towinly.common.enums;

/**
 * Reunions (2026-10-26): the seven steps an elder and their organiser walk,
 * numbered and visible like the Trust Ladder. Stored as its name in a VARCHAR.
 * WISH is the elder writing the wish; the row is created already on ORGANISER.
 * STOPPED is the elder's exit at any step before DONE.
 */
public enum ReunionStep {
    WISH, ORGANISER, FINDING, PLAN, DAY, SEND_OFF, DONE, STOPPED;

    /** 0..6 for the ladder; STOPPED keeps no position and reads as 0. */
    public int index() {
        return this == STOPPED ? 0 : ordinal();
    }

    public boolean isOver() {
        return this == DONE || this == STOPPED;
    }
}
