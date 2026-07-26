package com.towinly.family.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

/**
 * The helper's mirror of the standing derivation: for each of my elder
 * friendships, the family members who stand behind it. The helper only ever
 * learns who could already reach them — the gates are identical to
 * {@link FamilyStandingsResponse}.
 */
@Getter
@Builder
public class FamilyBehindResponse {

    private List<Entry> entries;

    @Getter
    @Builder
    public static class Entry {
        /** The elder↔helper connection this family member stands behind. */
        private UUID connectionId;
        private UUID elderUserId;
        private String elderName;
        private UUID familyUserId;
        private String familyName;
        private String familyPhotoUrl;
        /** The elder's word for them (Daughter, Son…) — may be null. */
        private String relationship;
        /** The family↔helper chat, once one has started. */
        private UUID chatConnectionId;
    }
}
