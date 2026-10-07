package com.towinly.discovery.dto;

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
    /** Up to three people from the viewer's circle who link them to this person:
     *  family first, then shared friends, then friends of friends. */
    private List<MutualFriendResponse> mutualFriends;
    /** How many family members and friends the viewer and this person share. */
    private int mutualCount;
}
