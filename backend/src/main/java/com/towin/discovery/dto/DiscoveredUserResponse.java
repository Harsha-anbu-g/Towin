package com.towin.discovery.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscoveredUserResponse {
    private UUID userId;
    private String name;
    private Integer age;
    private String photoUrl;
    private String bio;
    private List<String> interests;
    private List<String> languages;
    private String city;
    private Integer trustScore;
    private String trustTier;
    private List<String> skillsOffered;
    private double distanceKm;
}
