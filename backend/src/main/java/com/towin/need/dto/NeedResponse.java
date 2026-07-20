package com.towin.need.dto;

import com.towin.common.enums.*;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class NeedResponse {
    private UUID id;
    private UUID elderId;
    private String elderName;
    private String title;
    private NeedCategory category;
    private String description;
    private NeedSchedule schedule;
    private NeedUrgency urgency;
    private NeedStatus status;
    private ApplicationStatus myApplicationStatus;
    private Double distanceKm;
    private LocalDateTime createdAt;
    private List<ApplicantDto> applications;
    /** Who handled this for the elder, when it wasn't the elder themselves. */
    private String actedByName;
}
