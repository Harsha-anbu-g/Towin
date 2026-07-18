package com.towin.family.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/** Body of POST /api/family/requests/{id}/respond. */
@Getter
@Setter
public class FamilyRespondRequest {

    @NotNull(message = "Please say yes or no")
    private Boolean accept;
}
