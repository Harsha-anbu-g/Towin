package com.towinly.reunion.dto;

import com.towinly.common.enums.ReunionOrganiserKind;
import com.towinly.common.enums.ReunionStep;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** One reunion as the elder or the organiser sees it, guests and counts included. */
@Data
@Builder
public class ReunionResponse {
    private UUID id;
    private UUID elderId;
    private String elderName;
    private UUID organiserId;
    private String organiserName;
    private ReunionOrganiserKind organiserKind;
    private String institution;
    private String years;
    private String city;
    private String note;
    private String plannedOn;
    private String venue;
    private String rides;
    private String food;
    private String budget;
    private String thankYou;
    private ReunionStep step;
    /** 0..6, the ladder position; STOPPED reads 0. */
    private int stepIndex;
    /** "ELDER" or "ORGANISER": which seat the caller holds on this reunion. */
    private String myRole;
    private int guestCount;
    private int foundCount;
    private int reachedCount;
    private int comingCount;
    private int cannotComeCount;
    private int arrivedCount;
    private int homeCount;
    private List<ReunionGuestDto> guests;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime closedAt;
}
