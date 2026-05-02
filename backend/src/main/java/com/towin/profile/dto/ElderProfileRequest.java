package com.towin.profile.dto;

import com.towin.common.enums.LookingForType;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ElderProfileRequest {

    @NotBlank
    private String name;

    @NotNull @Min(50) @Max(120)
    private Integer age;

    private String bio;
    private String photoUrl;
    private String[] interests;
    private String[] languages;
    private LookingForType lookingFor = LookingForType.BOTH;
}
