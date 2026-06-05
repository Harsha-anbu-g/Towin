package com.towin.profile.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.profile.dto.*;
import com.towin.profile.entity.*;
import com.towin.profile.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final TrustScoreService trustScoreService;

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
        profile.setFacebookUrl(request.getFacebookUrl());
        profile.setInstagramUrl(request.getInstagramUrl());
        profile.setOccupation(request.getOccupation());
        if (request.getDateOfBirth() != null) {
            user.setDateOfBirth(request.getDateOfBirth());
            userRepository.save(user);
        }

        elderProfileRepository.save(profile);
        trustScoreService.recalculate(userId);
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
        profile.setHobbies(request.getHobbies());
        profile.setOccupation(request.getOccupation());
        profile.setFacebookUrl(request.getFacebookUrl());
        profile.setInstagramUrl(request.getInstagramUrl());
        profile.setDateOfBirth(request.getDateOfBirth());

        helperProfileRepository.save(profile);
        trustScoreService.recalculate(userId);
        return buildProfileResponse(user, null, profile);
    }

    @Transactional
    public void updateLocation(UUID userId, Double lat, Double lng) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setLocationLat(lat != null ? BigDecimal.valueOf(lat) : null);
        user.setLocationLng(lng != null ? BigDecimal.valueOf(lng) : null);
        userRepository.save(user);
    }

    @Transactional
    public void updatePhotoUrl(UUID userId, String photoUrl) {
        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        if (elder != null) {
            elder.setPhotoUrl(photoUrl);
            elderProfileRepository.save(elder);
            return;
        }
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null) {
            helper.setPhotoUrl(photoUrl);
            helperProfileRepository.save(helper);
        }
    }

    @Transactional
    public ProfileResponse updatePhone(UUID userId, String phone) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (phone.equals(user.getPhone())) {
            return buildProfileResponse(user, null, null);
        }
        user.setPhone(phone);
        user.setPhoneVerified(false);
        user.setPhoneOtp(null);
        user.setPhoneOtpExpiresAt(null);
        userRepository.save(user);
        return buildProfileResponse(user, null, null);
    }

    public ProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);

        return buildProfileResponse(user, elder, helper);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper) {
        int score = user.getTrustScore() != null ? user.getTrustScore() : 0;
        ProfileResponse.ProfileResponseBuilder builder = ProfileResponse.builder()
                .userId(user.getId())
                .role(user.getRole().name())
                .trustScore(score)
                .trustTier(TrustScoreService.tierFor(score))
                .verificationStatus(user.getVerificationStatus().name())
                .phoneVerified(user.isPhoneVerified())
                .phone(user.getPhone())
                .city(user.getCity())
                .dateOfBirth(user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null);

        if (elder != null) {
            builder.name(elder.getName())
                    .age(elder.getAge())
                    .photoUrl(elder.getPhotoUrl())
                    .bio(elder.getBio())
                    .interests(elder.getInterests())
                    .languages(elder.getLanguages())
                    .lookingFor(elder.getLookingFor().name())
                    .facebookUrl(elder.getFacebookUrl())
                    .instagramUrl(elder.getInstagramUrl())
                    .occupation(elder.getOccupation());
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
                    .backgroundCheckStatus(helper.getBackgroundCheckStatus().name())
                    .hobbies(helper.getHobbies())
                    .occupation(helper.getOccupation())
                    .facebookUrl(helper.getFacebookUrl())
                    .instagramUrl(helper.getInstagramUrl());
        }

        return builder.build();
    }
}
