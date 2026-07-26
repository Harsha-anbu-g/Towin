package com.towinly.auth.dto;

import com.towinly.common.enums.UserRole;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GuestLoginRequest {
    @NotNull
    private UserRole role;
}
