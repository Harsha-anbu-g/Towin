package com.towinly.reunion.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/** Step 4, the plan. Every field is words the elder reads; none is a form code. */
@Data
public class ReunionPlanRequest {
    @Size(max = 200)
    private String plannedOn;
    @Size(max = 300)
    private String venue;
    @Size(max = 1000)
    private String rides;
    @Size(max = 1000)
    private String food;
    @Size(max = 120)
    private String budget;
}
