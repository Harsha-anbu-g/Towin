package com.towin.emergency.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class EmergencyContactResponse {
    private UUID id;
    private String name;
    private String phone;
    private String relationship;
    private int inactivityDays;
}
