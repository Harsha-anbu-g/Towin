package com.towin.profile.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
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
    private final com.towin.geocoding.GeocodingService geocodingService;
    private final S3Service s3Service;

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
        profile.setGender(request.getGender());
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
        profile.setGender(request.getGender());
        profile.setFacebookUrl(request.getFacebookUrl());
        profile.setInstagramUrl(request.getInstagramUrl());
        profile.setDateOfBirth(request.getDateOfBirth());

        helperProfileRepository.save(profile);
        trustScoreService.recalculate(userId);
        return buildProfileResponse(user, null, profile);
    }

    @Transactional
    public void updateLocation(UUID userId, Double lat, Double lng, String cityHint) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setLocationLat(lat != null ? BigDecimal.valueOf(lat) : null);
        user.setLocationLng(lng != null ? BigDecimal.valueOf(lng) : null);
        if (lat != null && lng != null) {
            // Prefer a reverse-geocoded name; fall back to the city the frontend
            // resolved via forward geocode (cityHint) so the field is never blank.
            String city = geocodingService.reverseGeocode(lat, lng);
            if (city != null) user.setCity(city);
            else if (cityHint != null && !cityHint.isBlank()) user.setCity(cityHint);
        }
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
        return getProfile(userId, true);
    }

    public ProfileResponse getProfile(UUID userId, boolean isSelf) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);

        return buildProfileResponse(user, elder, helper, isSelf);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper) {
        return buildProfileResponse(user, elder, helper, true);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper, boolean isSelf) {
        int score = user.getTrustScore() != null ? (int) Math.round(user.getTrustScore()) : 0;
        // Email, phone, date of birth, and sign-in metadata are the owner's
        // business only — other users get the public fields (name, bio, trust).
        ProfileResponse.ProfileResponseBuilder builder = ProfileResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .email(isSelf ? user.getEmail() : null)
                // Default name from the linked Google account; overridden below once a profile exists
                .name(user.getFullName())
                .authProvider(isSelf ? user.getAuthProvider() : null)
                .hasPassword(isSelf && user.getPasswordHash() != null)
                .role(user.getRole().name())
                .trustScore(score)
                .trustTier(TrustScoreService.tierFor(score))
                .verificationStatus(user.getVerificationStatus().name())
                .phoneVerified(user.isPhoneVerified())
                .phone(isSelf ? user.getPhone() : null)
                .city(user.getCity())
                .dateOfBirth(isSelf && user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null);

        if (elder != null) {
            builder.name(elder.getName())
                    .age(elder.getAge())
                    .photoUrl(s3Service.presignedUrl(elder.getPhotoUrl()))
                    .bio(elder.getBio())
                    .interests(elder.getInterests())
                    .languages(elder.getLanguages())
                    .lookingFor(elder.getLookingFor().name())
                    .gender(elder.getGender() != null ? elder.getGender().name() : null)
                    .facebookUrl(elder.getFacebookUrl())
                    .instagramUrl(elder.getInstagramUrl())
                    .occupation(elder.getOccupation());
        }

        if (helper != null) {
            builder.name(helper.getName())
                    .age(helper.getAge())
                    .photoUrl(s3Service.presignedUrl(helper.getPhotoUrl()))
                    .bio(helper.getBio())
                    .languages(helper.getLanguages())
                    .skillsOffered(helper.getSkillsOffered())
                    .availabilityDays(helper.getAvailabilityDays())
                    .availabilityTimes(helper.getAvailabilityTimes())
                    .backgroundCheckStatus(helper.getBackgroundCheckStatus().name())
                    .hobbies(helper.getHobbies())
                    .occupation(helper.getOccupation())
                    .gender(helper.getGender() != null ? helper.getGender().name() : null)
                    .facebookUrl(helper.getFacebookUrl())
                    .instagramUrl(helper.getInstagramUrl());
        }

        return builder.build();
    }
}
