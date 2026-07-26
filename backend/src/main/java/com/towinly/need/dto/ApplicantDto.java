package com.towinly.need.dto;

import com.towinly.common.enums.ApplicationStatus;
import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class ApplicantDto {
    private UUID helperId;
    private String helperName;
    private String helperPhotoUrl;
    private String message;
    private ApplicationStatus status;
}
