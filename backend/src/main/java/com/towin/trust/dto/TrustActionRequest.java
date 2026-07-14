package com.towin.trust.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TrustActionRequest {
    @Size(max = 1000, message = "Please keep your note under 1000 characters.")
    private String note;
}
