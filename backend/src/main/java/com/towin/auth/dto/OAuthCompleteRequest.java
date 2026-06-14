package com.towin.auth.dto;

import com.towin.common.enums.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
    @NotBlank @Pattern(regexp = "^[a-z0-9_]{3,20}$", message = "Username must be 3-20 characters: lowercase letters, numbers, underscores only")
    private String username;
    @NotBlank @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;
}
