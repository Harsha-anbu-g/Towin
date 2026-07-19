package com.towin.family.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.UUID;

/** Step 4: the shared elder↔helper connection whose helper the family member wants to reach. */
@Data
public class HelperConnectionRequest {
    @NotNull
    private UUID connectionId;
}
