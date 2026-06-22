package com.towin.profile.dto;

import com.towin.common.enums.Gender;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class HelperProfileRequest {

    @NotBlank
    @Size(max = 100)
    private String name;

    @NotNull @Min(18) @Max(80)
    private Integer age;

    @Size(max = 1000)
    private String bio;
    private String photoUrl;
    private String[] skillsOffered;
    private String[] languages;
    private String[] availabilityDays;
    private String[] availabilityTimes;
    private String[] hobbies;
    private String occupation;
    private Gender gender;
    @Pattern(regexp = "^(https://.*)?$", message = "Must be a valid HTTPS URL or empty")
    private String facebookUrl;
    @Pattern(regexp = "^(https://.*)?$", message = "Must be a valid HTTPS URL or empty")
    private String instagramUrl;
    private java.time.LocalDate dateOfBirth;
}
