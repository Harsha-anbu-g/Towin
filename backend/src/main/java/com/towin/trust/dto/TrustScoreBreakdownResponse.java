package com.towin.trust.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class TrustScoreBreakdownResponse {

    private double totalScore;
    private String tier;

    private BasicSection basic;
    private RootingSection rooting;
    private ReviewSection review;

    @Data
    @Builder
    public static class BasicSection {
        private double earned;
        private double max;
        private List<ProfileField> fields;
    }

    @Data
    @Builder
    public static class ProfileField {
        private String key;
        private String label;
        private boolean completed;
        private String tip;
    }

    @Data
    @Builder
    public static class RootingSection {
        private int earned;
        private int relationshipCount;
        private String detail;
    }

    @Data
    @Builder
    public static class ReviewSection {
        private int earned;
        private int reviewCount;
        private String detail;
    }
}
