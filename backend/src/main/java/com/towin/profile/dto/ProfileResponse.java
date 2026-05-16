package com.towin.profile.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class ProfileResponse {
    private UUID userId;
    private String name;
    private Integer age;
    private String photoUrl;
    private String bio;
    private String[] interests;
    private String[] languages;
    private String role;
    private Integer trustScore;
    private String trustTier;
    private String verificationStatus;
    private String city;
    private String lookingFor;
    private String[] skillsOffered;
    private String[] availabilityDays;
    private String[] availabilityTimes;
    private String backgroundCheckStatus;
    private boolean phoneVerified;
    private String phone;
}
