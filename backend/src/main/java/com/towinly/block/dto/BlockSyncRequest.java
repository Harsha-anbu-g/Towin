package com.towinly.block.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * The list a phone already held before blocks moved to the server. Posted once, so
 * nobody loses protection they set while the list lived only on their device.
 */
@Data
public class BlockSyncRequest {
    @NotNull
    @Size(max = 500)
    private List<UUID> blockedUserIds;
}
