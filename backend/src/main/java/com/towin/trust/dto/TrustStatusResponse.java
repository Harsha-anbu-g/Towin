package com.towin.trust.dto;

import com.towin.common.enums.TrustLevel;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TrustStatusResponse {

    private UUID connectionId;
    private TrustLevel currentLevel;
    private boolean confirmedByMe;
    private boolean confirmedByOther;
    private boolean canAdvance;
    private List<TrustLogEntry> history;

    @Data
    @Builder
    public static class TrustLogEntry {
        private TrustLevel fromLevel;
        private TrustLevel toLevel;
        private UUID confirmedBy;
        // Guardian mode: the family member who took this step for the person whose
        // seat it was. Null on every step someone took themselves.
        private String actedByName;
        private UUID actedByUserId;
        private String note;
        private LocalDateTime createdAt;
    }
}
