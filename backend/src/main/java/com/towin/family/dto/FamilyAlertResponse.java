package com.towin.family.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

/** One in-app family alert as seen by a linked family member. */
@Getter
@Builder
public class FamilyAlertResponse {

    private UUID id;
    private UUID elderId;
    private String elderName;
    /** SOS | FIRST_MEET | INACTIVITY (see FamilyAlertType). */
    private String type;
    private String body;
    private LocalDateTime createdAt;
}
