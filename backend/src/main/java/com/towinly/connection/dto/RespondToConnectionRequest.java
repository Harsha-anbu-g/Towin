package com.towinly.connection.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RespondToConnectionRequest {

    @NotNull
    private Boolean accept;
}
