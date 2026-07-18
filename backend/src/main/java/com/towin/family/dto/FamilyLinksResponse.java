package com.towin.family.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** Body of GET /api/family/links: the caller's whole family picture. */
@Getter
@Builder
public class FamilyLinksResponse {

    private List<FamilyLinkResponse> activeLinks;
    private List<FamilyLinkResponse> incomingRequests;
    private List<FamilyLinkResponse> outgoingRequests;
}
