package com.towin.need.dto;

import com.towin.common.enums.ApplicationStatus;
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
