package com.towinly.reunion.dto;

import com.towinly.common.enums.ReunionGuestState;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ReunionGuestDto {
    private UUID id;
    private String name;
    private String phone;
    private String note;
    private ReunionGuestState state;
    private LocalDateTime arrivedAt;
    private LocalDateTime homeAt;
}
