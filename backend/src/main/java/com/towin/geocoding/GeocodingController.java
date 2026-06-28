package com.towin.geocoding;

import com.towin.geocoding.dto.GeoResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/geocode")
@RequiredArgsConstructor
public class GeocodingController {

    private final GeocodingService geocodingService;

    // Returns the best lat/lng/city for a typed place, or 404 when nothing matches.
    @GetMapping("/search")
    public ResponseEntity<GeoResult> search(@RequestParam("q") String query) {
        return geocodingService.forwardGeocode(query)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
