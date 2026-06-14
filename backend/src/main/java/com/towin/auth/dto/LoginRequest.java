package com.towin.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank
    private String identifier; // username, email, or verified phone number

    @NotBlank
    private String password;
}
