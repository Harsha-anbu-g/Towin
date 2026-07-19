package com.towin.family.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

/** The helpers a family member can reach through their elders' shared trust. */
@Getter
@Builder
public class FamilyStandingsResponse {

    private List<Standing> standings;

    @Getter
    @Builder
    public static class Standing {
        /** The elder's shared connection this standing derives from. */
        private UUID standingConnectionId;
        private String elderName;
        private UUID helperUserId;
        private String helperName;
        private String helperPhotoUrl;
        /** The elder's ladder stage, in the same words the elder sees. */
        private String stageLabel;
        private int stageIndex;
        private boolean paused;
        /** The family↔helper FAMILY connection, once chat has started. */
        private UUID chatConnectionId;
    }
}
