package com.towin.need.dto;

import com.towin.common.enums.NeedCategory;
import com.towin.common.enums.NeedSchedule;
import com.towin.common.enums.NeedUrgency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

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

    /**
     * Guardian mode: set when a family member is posting this for their parent.
     * Left empty by everyone posting for themselves. The server checks the parent
     * really did grant that power — this field only names who the help is for.
     */
    private UUID onBehalfOfElderId;
}
