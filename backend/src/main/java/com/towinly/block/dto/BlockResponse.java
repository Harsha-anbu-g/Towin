package com.towinly.block.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/** One blocked person, as the blocker's own list shows them. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockResponse {
    private UUID userId;
    private String name;
    private LocalDateTime createdAt;
}
