package com.towin.auth.dto;

import com.towin.common.enums.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class OAuthCompleteRequest {
    @NotBlank
    private String onboardingToken;
    @NotNull
    private UserRole role;
    @NotBlank
    private String phone;
}
