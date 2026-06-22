package com.towin.profile.dto;

import com.towin.common.enums.Gender;
import com.towin.common.enums.LookingForType;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.LocalDate;

@Data
public class ElderProfileRequest {

    @NotBlank
    @Size(max = 100)
    private String name;

    @NotNull @Min(1) @Max(150)
    private Integer age;

    @Size(max = 1000)
    private String bio;
    private String photoUrl;
    private String[] interests;
    private String[] languages;
    private LookingForType lookingFor = LookingForType.BOTH;
    @Pattern(regexp = "^(https://.*)?$", message = "Must be a valid HTTPS URL or empty")
    private String facebookUrl;
    @Pattern(regexp = "^(https://.*)?$", message = "Must be a valid HTTPS URL or empty")
    private String instagramUrl;
    private String occupation;
    private Gender gender;
    private LocalDate dateOfBirth;
}
