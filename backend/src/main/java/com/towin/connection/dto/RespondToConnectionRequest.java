package com.towin.connection.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RespondToConnectionRequest {

    @NotNull
    private Boolean accept;
}
