package com.towinly.block.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class BlockRequest {
    @NotNull
    private UUID blockedUserId;
}
