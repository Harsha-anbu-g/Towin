package com.towinly.connection.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FamilyVisibilityRequest {

    @NotNull
    private Boolean shared;
}
