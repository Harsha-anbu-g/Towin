package com.towin.need.dto;

import com.towin.common.enums.NeedCategory;
import com.towin.common.enums.NeedSchedule;
import com.towin.common.enums.NeedUrgency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class NeedRequest {

    @NotBlank
    private String title;

    @NotNull
    private NeedCategory category;

    private String description;

    private NeedSchedule schedule = NeedSchedule.ONE_TIME;

    private NeedUrgency urgency = NeedUrgency.NORMAL;

    private Double locationLat;
    private Double locationLng;
}
