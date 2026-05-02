package com.towin.profile.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.profile.dto.*;
import com.towin.profile.entity.*;
import com.towin.profile.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;

    @Transactional
    public ProfileResponse createOrUpdateElderProfile(UUID userId, ElderProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ElderProfile profile = elderProfileRepository.findByUserId(userId)
                .orElse(ElderProfile.builder().user(user).build());

        profile.setName(request.getName());
        profile.setAge(request.getAge());
        profile.setBio(request.getBio());
        profile.setPhotoUrl(request.getPhotoUrl());
        profile.setInterests(request.getInterests());
        profile.setLanguages(request.getLanguages());
        if (request.getLookingFor() != null) {
            profile.setLookingFor(request.getLookingFor());
        }

        elderProfileRepository.save(profile);
        return buildProfileResponse(user, profile, null);
    }

    @Transactional
    public ProfileResponse createOrUpdateHelperProfile(UUID userId, HelperProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        HelperProfile profile = helperProfileRepository.findByUserId(userId)
                .orElse(HelperProfile.builder().user(user).build());

        profile.setName(request.getName());
        profile.setAge(request.getAge());
        profile.setBio(request.getBio());
        profile.setPhotoUrl(request.getPhotoUrl());
        profile.setSkillsOffered(request.getSkillsOffered());
        profile.setLanguages(request.getLanguages());
        profile.setAvailabilityDays(request.getAvailabilityDays());
        profile.setAvailabilityTimes(request.getAvailabilityTimes());

        helperProfileRepository.save(profile);
        return buildProfileResponse(user, null, profile);
    }

    public ProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);

        return buildProfileResponse(user, elder, helper);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper) {
        ProfileResponse.ProfileResponseBuilder builder = ProfileResponse.builder()
                .userId(user.getId())
                .role(user.getRole().name())
                .trustScore(user.getTrustScore())
                .verificationStatus(user.getVerificationStatus().name())
                .city(user.getCity());

        if (elder != null) {
            builder.name(elder.getName())
                    .age(elder.getAge())
                    .photoUrl(elder.getPhotoUrl())
                    .bio(elder.getBio())
                    .interests(elder.getInterests())
                    .languages(elder.getLanguages())
                    .lookingFor(elder.getLookingFor().name());
        }

        if (helper != null) {
            builder.name(helper.getName())
                    .age(helper.getAge())
                    .photoUrl(helper.getPhotoUrl())
                    .bio(helper.getBio())
                    .languages(helper.getLanguages())
                    .skillsOffered(helper.getSkillsOffered())
                    .availabilityDays(helper.getAvailabilityDays())
                    .availabilityTimes(helper.getAvailabilityTimes())
                    .backgroundCheckStatus(helper.getBackgroundCheckStatus().name());
        }

        return builder.build();
    }
}
