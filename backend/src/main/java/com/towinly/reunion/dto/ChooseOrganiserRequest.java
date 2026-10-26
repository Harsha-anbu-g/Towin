package com.towinly.reunion.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ChooseOrganiserRequest {
    @NotNull
    private UUID organiserId;
}
