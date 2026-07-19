package com.towin.family.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

/**
 * Step 2: the family journey view — one entry per ACTIVE-linked elder of the
 * caller. Shared connections only (shared_with_family gates everything);
 * deliberately NO phone/email/social fields anywhere — helper name, photo,
 * score, tier and ladder stage are the whole surface family may see.
 */
@Getter
@Builder
public class FamilyJourneyResponse {

    private List<ElderJourney> elders;

    @Getter
    @Builder
    public static class ElderJourney {
        private UUID elderId;
        private String elderName;
        private String elderPhotoUrl;      // presigned, short-lived
        private boolean checkedInToday;    // streaks: last check-in date == today
        private long openNeedsCount;       // elder's OPEN help requests
        private List<SharedHelper> sharedHelpers;
    }

    @Getter
    @Builder
    public static class SharedHelper {
        private UUID connectionId;
        private String helperName;
        private String helperPhotoUrl;     // presigned, short-lived
        private int trustScore;
        private String tier;               // TrustScoreService.tierFor
        private int stageIndex;            // TrustLevel value 0–6
        private String stageLabel;         // same words the elder sees on the ladder
        private boolean readyToMeet;       // stageIndex == FIRST_MEET
    }
}
