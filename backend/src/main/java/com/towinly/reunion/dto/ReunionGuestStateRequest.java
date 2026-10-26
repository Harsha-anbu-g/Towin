package com.towinly.reunion.dto;

import com.towinly.common.enums.ReunionGuestState;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReunionGuestStateRequest {
    @NotNull
    private ReunionGuestState state;
}
