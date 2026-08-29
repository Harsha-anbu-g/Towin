package com.towinly.need.dto;

import com.towinly.common.enums.NeedCategory;
import com.towinly.common.enums.NeedSchedule;
import com.towinly.common.enums.NeedUrgency;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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

    // The same range guard UpdateLocationRequest has carried all along. A need
    // is stored with a coordinate, so it deserves the same door.
    @Min(-90) @Max(90)
    private Double locationLat;
    @Min(-180) @Max(180)
    private Double locationLng;

    /**
     * Guardian mode: set when a family member is posting this for their parent.
     * Left empty by everyone posting for themselves. The server checks the parent
     * really did grant that power — this field only names who the help is for.
     */
    private UUID onBehalfOfElderId;
}
