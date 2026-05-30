package com.towin.auth.dto;

import com.towin.common.enums.UserRole;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class GuestLoginRequest {
    @NotNull
    private UserRole role;
}
