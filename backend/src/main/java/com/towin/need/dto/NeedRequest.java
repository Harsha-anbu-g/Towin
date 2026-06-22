package com.towin.need.dto;

import com.towin.common.enums.NeedCategory;
import com.towin.common.enums.NeedSchedule;
import com.towin.common.enums.NeedUrgency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class NeedRequest {

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotNull
    private NeedCategory category;

    @Size(max = 2000)
    private String description;

    private NeedSchedule schedule = NeedSchedule.ONE_TIME;

    private NeedUrgency urgency = NeedUrgency.NORMAL;

    private Double locationLat;
    private Double locationLng;
}
