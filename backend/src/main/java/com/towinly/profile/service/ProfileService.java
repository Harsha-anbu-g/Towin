package com.towinly.profile.service;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.S3Service;
import com.towinly.common.service.TrustScoreService;
import com.towinly.profile.dto.*;
import com.towinly.profile.entity.*;
import com.towinly.profile.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.TrustLevel;
import com.towinly.common.geo.CoarseLocation;
import com.towinly.block.service.BlockService;
import com.towinly.connection.repository.ConnectionRepository;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final TrustScoreService trustScoreService;
    private final com.towinly.geocoding.GeocodingService geocodingService;
    private final S3Service s3Service;
    private final ConnectionRepository connectionRepository;
    private final BlockService blockService;

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
        // SEC-01: the cell is stored, never the fix. The city lookup keeps the fix.
        user.setLocationLat(CoarseLocation.snapOrNull(lat));
        user.setLocationLng(CoarseLocation.snapOrNull(lng));
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

    /** The owner's own profile, with every private field. Used by /profile/me. */
    public ProfileResponse getProfile(UUID userId) {
        return getProfile(userId, userId);
    }

    /** One person's profile as a named viewer is allowed to see it. */
    public ProfileResponse getProfile(UUID targetUserId, UUID viewerUserId) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ElderProfile elder = elderProfileRepository.findByUserId(targetUserId).orElse(null);
        HelperProfile helper = helperProfileRepository.findByUserId(targetUserId).orElse(null);

        boolean isSelf = viewerUserId != null && viewerUserId.equals(targetUserId);
        return buildProfileResponse(user, elder, helper, isSelf,
                isSelf || socialsUnlocked(viewerUserId, targetUserId));
    }

    /**
     * Facebook, Instagram and gender are the trust ladder's step 4. Only the owner,
     * or someone on an ACTIVE connection that has climbed to VERIFIED, gets them.
     *
     * ACTIVE is the load-bearing half: a helper scoring 71+ opens a PENDING request
     * already stamped VERIFIED (ConnectionService.sendRequest), so a level-only test
     * would be one connection request away from handing a stranger the handles.
     *
     * A family link never reaches VERIFIED (family connections earn no trust points),
     * so a daughter does not read her mother's handles here. Nothing renders them
     * today; if that should change it needs its own decision, not a wider gate.
     */
    private boolean socialsUnlocked(UUID viewerId, UUID targetId) {
        if (viewerId == null) return false;
        // HARD-106: a block outlives the connection it was made on.
        if (blockService.isHidden(viewerId, targetId)) return false;
        return connectionRepository.findBetweenUsers(viewerId, targetId)
                .filter(c -> c.getStatus() == ConnectionStatus.ACTIVE)
                .map(c -> c.getCurrentTrustLevel() != null
                        && c.getCurrentTrustLevel().getValue() >= TrustLevel.VERIFIED.getValue())
                .orElse(false);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper) {
        // The write paths (create, update, phone) answer the owner about themselves.
        return buildProfileResponse(user, elder, helper, true, true);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper,
                                                 boolean isSelf, boolean socialsUnlocked) {
        int score = user.getTrustScore() != null ? (int) Math.round(user.getTrustScore()) : 0;
        // Email, phone, date of birth, and sign-in metadata are the owner's
        // business only. Social handles and gender ride the trust ladder on top of
        // that (see socialsUnlocked); other users get the public card: name, bio,
        // age, city, occupation and trust.
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
                    .gender(socialsUnlocked && elder.getGender() != null ? elder.getGender().name() : null)
                    .facebookUrl(socialsUnlocked ? elder.getFacebookUrl() : null)
                    .instagramUrl(socialsUnlocked ? elder.getInstagramUrl() : null)
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
                    .gender(socialsUnlocked && helper.getGender() != null ? helper.getGender().name() : null)
                    .facebookUrl(socialsUnlocked ? helper.getFacebookUrl() : null)
                    .instagramUrl(socialsUnlocked ? helper.getInstagramUrl() : null);
        }

        return builder.build();
    }
}
