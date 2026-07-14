package com.towin.profile.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateLocationRequest {

    // Coordinates stay optional: the browser may deny geolocation, in which case
    // only a city (or nothing at all) is sent.
    @Min(-90) @Max(90)
    private Double locationLat;

    @Min(-180) @Max(180)
    private Double locationLng;

    @Size(max = 100)
    private String city;
}
