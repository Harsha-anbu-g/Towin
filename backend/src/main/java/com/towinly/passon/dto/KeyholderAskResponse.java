package com.towinly.passon.dto;

import java.util.UUID;

/**
 * One "somebody has asked you to hold a key" card, on the family member's own screen.
 *
 * @param approvalsNeeded how many Keyholders would have to agree, or null when the elder has
 *                        not chosen yet. Null is real and common: she may ask people before
 *                        she picks the number. The card leaves the sentence out rather than
 *                        inventing one — telling somebody "two of the three of you" when
 *                        nobody has decided that would be a made-up promise about a death.
 * @param keyholderCount  how many people she has asked altogether, counted now.
 */
public record KeyholderAskResponse(
        UUID id,
        UUID ownerId,
        String ownerName,
        Short approvalsNeeded,
        Integer keyholderCount
) {
}
