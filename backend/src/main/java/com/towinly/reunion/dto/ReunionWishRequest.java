package com.towinly.reunion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Step 1, the wish: who the elder wants to see again, in their own words. */
@Data
public class ReunionWishRequest {
    @NotBlank @Size(max = 200)
    private String institution;
    @Size(max = 60)
    private String years;
    @Size(max = 120)
    private String city;
    @Size(max = 2000)
    private String note;
}
