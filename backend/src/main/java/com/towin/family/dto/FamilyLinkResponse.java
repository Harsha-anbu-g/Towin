package com.towin.family.dto;

import com.towin.common.enums.FamilyLinkStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

/** One family link (or pending request) as seen by the calling user. */
@Getter
@Builder
public class FamilyLinkResponse {

    private UUID id;
    private UUID elderId;
    private UUID familyUserId;
    /** The person on the other side of the link from the caller. */
    private UUID otherUserId;
    private String otherUserName;
    private String relationship;
    private Boolean isPrimary;
    private FamilyLinkStatus status;
    private boolean initiatedByMe;
    /** True when the caller sits in the elder seat of this link. */
    private boolean iAmElder;
    private LocalDateTime createdAt;
    private LocalDateTime respondedAt;
}
