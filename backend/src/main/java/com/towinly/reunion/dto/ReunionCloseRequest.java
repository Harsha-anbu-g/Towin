package com.towinly.reunion.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/** The send-off: the thank-you that goes with Towinly's name on it. */
@Data
public class ReunionCloseRequest {
    @Size(max = 1000)
    private String thankYou;
}
