package com.towinly.reunion.dto;

import com.towinly.common.enums.ReunionOrganiserKind;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/** Someone the elder may choose to plan the reunion, and why they are allowed. */
@Data
@Builder
public class OrganiserCandidateDto {
    private UUID userId;
    private String name;
    private String photoUrl;
    private ReunionOrganiserKind kind;
    /** The elder-helper connection that reached full trust; null for family. */
    private UUID connectionId;
    /** "Daughter", "Son" and so on from the family link; null for helpers. */
    private String relationship;
}
