package com.towin.profile.dto;

import com.towin.common.enums.LookingForType;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.LocalDate;

@Data
public class ElderProfileRequest {

    @NotBlank
    private String name;

    @NotNull @Min(1) @Max(150)
    private Integer age;

    private String bio;
    private String photoUrl;
    private String[] interests;
    private String[] languages;
    private LookingForType lookingFor = LookingForType.BOTH;
    private String facebookUrl;
    private String instagramUrl;
    private String occupation;
    private LocalDate dateOfBirth;
}
