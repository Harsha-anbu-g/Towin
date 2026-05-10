package com.towin.emergency.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class EmergencyContactRequest {
    @NotBlank
    private String name;
    @NotBlank
    private String phone;
    private String relationship;
    @Min(1)
    private int inactivityDays = 5;
}
