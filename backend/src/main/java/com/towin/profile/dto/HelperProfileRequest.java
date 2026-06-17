package com.towin.profile.dto;

import com.towin.common.enums.Gender;
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
    private String[] hobbies;
    private String occupation;
    private Gender gender;
    private String facebookUrl;
    private String instagramUrl;
    private java.time.LocalDate dateOfBirth;
}
