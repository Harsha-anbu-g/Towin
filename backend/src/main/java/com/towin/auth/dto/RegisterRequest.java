package com.towin.auth.dto;

import com.towin.common.enums.UserRole;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.LocalDate;

@Data
public class RegisterRequest {
    @Email @NotBlank
    private String email;

    @NotBlank @Pattern(regexp = "^\\+?[0-9]{10,15}$", message = "Invalid phone number")
    private String phone;

    @NotBlank @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @NotNull
    private UserRole role;

    private LocalDate dateOfBirth;
}
