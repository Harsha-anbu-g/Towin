package com.towin.family.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.UUID;

/**
 * Step 4 transparency (locked rule 7): the elder always sees which of their
 * family members are directly connected with which helpers. Names and ids
 * only — never contact details.
 */
@Data
@Builder
public class ElderTransparencyResponse {

    private List<Row> connections;

    @Data
    @Builder
    public static class Row {
        private String familyMemberName;
        private String relationship;   // "Daughter", free text from the family link
        private UUID helperUserId;     // lets the elder UI match its connection cards
        private String helperName;
        /** True when the reach comes from inherited standing (your shared trust)
         *  rather than an already-opened chat. */
        private boolean inherited;
    }
}
