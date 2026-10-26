package com.towinly.reunion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReunionGuestRequest {
    @NotBlank @Size(max = 120)
    private String name;
    @Size(max = 40)
    private String phone;
    @Size(max = 300)
    private String note;
}
