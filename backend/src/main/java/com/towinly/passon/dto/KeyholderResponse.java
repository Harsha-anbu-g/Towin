package com.towinly.passon.dto;

import com.towinly.common.enums.KeyholderStatus;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One person on the elder's own "Who can open it one day" list.
 *
 * Facts only, no sentences. "Sarah said yes on 2 June" and "David has not answered yet" are
 * built on the screen from {@code passOnLocks.js}, so the elder's page, the acceptance card
 * and the saved one-page copy all say the same thing in the same words.
 *
 * @param countsToward whether this person counts toward the number who must agree, worked
 *                     out on the spot from the status <em>and</em> a live family link. It is
 *                     never read from a column, because a stored answer would keep counting
 *                     a daughter who unlinked herself last night.
 */
public record KeyholderResponse(
        UUID id,
        UUID personId,
        String personName,
        KeyholderStatus status,
        boolean countsToward,
        LocalDateTime invitedAt,
        LocalDateTime respondedAt
) {
}
