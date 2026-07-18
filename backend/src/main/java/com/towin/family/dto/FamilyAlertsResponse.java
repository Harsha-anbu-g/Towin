package com.towin.family.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** Body of GET /api/family/alerts: the caller's linked elders' alerts, newest first. */
@Getter
@Builder
public class FamilyAlertsResponse {

    private List<FamilyAlertResponse> alerts;
}
