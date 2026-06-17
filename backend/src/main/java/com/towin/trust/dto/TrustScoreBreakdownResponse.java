package com.towin.trust.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TrustScoreBreakdownResponse {

    private double totalScore;
    private String tier;

    /** Max points a single customer can ever be worth (rooting 7 + review 5 + profile 3). */
    private int maxPerCustomer;

    /** Your profile readiness — the same value silently adds to every customer. */
    private ProfileSection profile;

    /** One card per active customer relationship. */
    private List<CustomerCard> customers;

    @Data
    @Builder
    public static class ProfileSection {
        private int earned;          // 0–3
        private int max;             // 3
        private List<ProfileTask> tasks;
    }

    @Data
    @Builder
    public static class ProfileTask {
        private String key;
        private String label;
        private boolean completed;
        private String tip;          // shown only when not completed
    }

    @Data
    @Builder
    public static class CustomerCard {
        private UUID connectionId;
        private String customerName;
        private String customerPhotoUrl;

        private String currentStageLabel;  // e.g. "Phone Ready"
        private int stageIndex;            // 0–6 (TrustLevel value)

        private int rooting;     // 0–7
        private int rootingMax;  // 7

        private int review;      // 0–5
        private int reviewMax;   // 5
        private boolean hasReview;

        private int profile;     // 0–3 (mirrors ProfileSection.earned)
        private int profileMax;  // 3

        private int total;       // rooting + review + profile, 0–15
        private int totalMax;    // 15
    }
}
