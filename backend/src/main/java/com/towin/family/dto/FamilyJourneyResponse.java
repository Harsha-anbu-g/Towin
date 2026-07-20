package com.towin.family.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
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
        private List<OpenNeed> openNeeds;  // the actual OPEN requests, read-only for family
        private List<SharedHelper> sharedHelpers;
    }

    /** One of the elder's OPEN help requests, shown to family read-only. No
     *  responder/applicant data — family may see what the parent asked for, not act on it. */
    @Getter
    @Builder
    public static class OpenNeed {
        private UUID id;
        private String title;
        private String category;        // NeedCategory.name() — a plain label for the UI
        private String description;
        private LocalDateTime createdAt;
    }

    @Getter
    @Builder
    public static class SharedHelper {
        private UUID connectionId;
        private UUID helperUserId;   // lets the family UI match their own connection state (Step 4)
        private String helperName;
        private String helperPhotoUrl;     // presigned, short-lived
        private int trustScore;
        private String tier;               // TrustScoreService.tierFor
        private int stageIndex;            // TrustLevel value 0–6
        private String stageLabel;         // same words the elder sees on the ladder
        private String currentTrustLevel;  // TrustLevel enum name, for the read-only trust bar
        private boolean readyToMeet;       // stageIndex == FIRST_MEET
    }
}
