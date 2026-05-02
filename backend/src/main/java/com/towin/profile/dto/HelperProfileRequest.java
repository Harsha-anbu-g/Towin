package com.towin.profile.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class HelperProfileRequest {

    @NotBlank
    private String name;

    @NotNull @Min(18) @Max(80)
    private Integer age;

    private String bio;
    private String photoUrl;
    private String[] skillsOffered;
    private String[] languages;
    private String[] availabilityDays;
    private String[] availabilityTimes;
}
