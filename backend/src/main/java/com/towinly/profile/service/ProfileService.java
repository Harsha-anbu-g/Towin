package com.towinly.profile.service;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.S3Service;
import com.towinly.common.service.TrustScoreService;
import com.towinly.profile.dto.*;
import com.towinly.profile.entity.*;
import com.towinly.profile.repository.*;
import com.towinly.common.service.CoarseLocation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.TrustLevel;
import com.towinly.block.service.BlockService;
import java.math.BigDecimal;
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
    // SEC-06: the ladder's own rung 4 is named "Socials", so the handles are
    // gated on reaching it. A repository has no dependencies of its own, so
    // reading connections here introduces no cycle.
    private final com.towinly.connection.repository.ConnectionRepository connectionRepository;
    // A block refuses the whole profile read, in both directions (see requireNoBlock).
    private final BlockService blockService;
    // A refused change reveals the number is a member's, so changes are capped per user.
    private final com.towinly.profile.security.PhoneChangeRateLimiter phoneChangeRateLimiter;

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
        // SEC-01: snap to the 0.02 degree cell before storing. The phone already
        // coarsens, but the website sends the raw browser fix and any other API
        // client could too, so the grid is enforced here where every caller meets
        // it. /discover answers a distance from a caller-chosen origin, so a
        // precise stored point is trilaterable to a doorstep; a grid vertex is
        // only ever recoverable as its own ~2.2 km cell.
        user.setLocationLat(CoarseLocation.snap(lat));
        user.setLocationLng(CoarseLocation.snapLng(lng));
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
        phoneChangeRateLimiter.check(userId);
        user.setPhone(phone);
        user.setPhoneVerified(false);
        user.setPhoneOtp(null);
        user.setPhoneOtpExpiresAt(null);
        userRepository.save(user);
        return buildProfileResponse(user, null, null);
    }

    /** The owner reading their own profile (GET /profile/me). */
    public ProfileResponse getProfile(UUID userId) {
        return getProfile(userId, userId);
    }

    /**
     * A profile as one viewer sees it. viewerId is the signed-in caller, or null
     * for an unauthenticated read; passing the subject's own id means self.
     */
    public ProfileResponse getProfile(UUID userId, UUID viewerId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean isSelf = viewerId != null && viewerId.equals(userId);
        requireNoBlock(viewerId, userId, isSelf);

        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);

        return buildProfileResponse(user, elder, helper, isSelf,
                isSelf || socialsUnlocked(viewerId, userId));
    }

    /**
     * HARD-106: a block closes this read the way it already closes the chat, the help
     * request and every listing. Without it the family screens dropped a blocked helper's
     * card while the profile that card linked to still served her name, photo, bio and
     * trust score to the person she had cut off.
     *
     * The pair here is the two people in the read and nobody else, so this cuts contact
     * and never a third party's sight of anyone: an elder blocking a helper leaves her
     * family's read of that helper exactly as it was, which is a safeguarding surface and
     * not the blocker's to switch off.
     *
     * Refused with the sentence every other block gate throws, which names no block: the
     * blocked person is never told. It runs after the lookup above so an account that is
     * really gone still reads as gone, and before the profile rows so a refused read
     * loads nothing about the person it refuses.
     */
    private void requireNoBlock(UUID viewerId, UUID targetId, boolean isSelf) {
        // Nobody can block themselves, and /profile/me must never pay for a block query.
        if (isSelf || viewerId == null) return;
        if (blockService.isHidden(viewerId, targetId)) {
            throw new IllegalStateException(BlockService.NOT_AVAILABLE);
        }
    }

    /**
     * Facebook, Instagram and gender are the trust ladder's step 4. Only the owner, or
     * someone on a live friendship that has climbed to VERIFIED, gets them.
     *
     * ACTIVE (or PAUSED — a paused friendship keeps what it earned) is one
     * load-bearing half: a helper scoring 71+ opens a PENDING request already stamped
     * VERIFIED (ConnectionService.sendRequest), so a level-only test would be one
     * connection request away from handing a stranger the handles.
     *
     * Skipping FAMILY is the other, exactly as PassOnVisibilityService reads the same
     * question. A FAMILY row is a coordination chat that earns no trust points of its
     * own, but it can still carry a high level: FamilyStandingService.openHelperChat and
     * openFamilyMemberChat reopen a terminal row by stamping it FAMILY and ACTIVE, and
     * they set the trust level only when it is null. A friendship that once reached
     * TRUSTED therefore comes back as a coordination chat still holding TRUSTED, and
     * without this filter that chat would open somebody's handles.
     *
     * A block never reaches here: requireNoBlock has already refused the whole read.
     *
     * The pair is read as a list and not as one row. Two rows for one pair is an ordinary
     * outcome (see ConnectionRepository.findAllBetweenUsers), and any live row that
     * qualifies is enough: a stale declined row must not shut a real friendship out of
     * what it earned, and a single-row read threw on that pair instead of answering.
     */
    private boolean socialsUnlocked(UUID viewerId, UUID targetId) {
        if (viewerId == null) return false;
        return connectionRepository.findAllBetweenUsers(viewerId, targetId).stream()
                .filter(c -> ConnectionType.earnsTrust(c.getType()))
                .filter(c -> c.getStatus() == ConnectionStatus.ACTIVE
                        || c.getStatus() == ConnectionStatus.PAUSED)
                .anyMatch(c -> c.getCurrentTrustLevel() != null
                        && c.getCurrentTrustLevel().getValue() >= TrustLevel.VERIFIED.getValue());
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper) {
        // The owner reading or saving their own profile: everything is theirs.
        return buildProfileResponse(user, elder, helper, true, true);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper,
                                                 boolean isSelf, boolean socialsVisible) {
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
                    .gender(socialsVisible && elder.getGender() != null ? elder.getGender().name() : null)
                    .facebookUrl(socialsVisible ? elder.getFacebookUrl() : null)
                    .instagramUrl(socialsVisible ? elder.getInstagramUrl() : null)
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
                    .gender(socialsVisible && helper.getGender() != null ? helper.getGender().name() : null)
                    .facebookUrl(socialsVisible ? helper.getFacebookUrl() : null)
                    .instagramUrl(socialsVisible ? helper.getInstagramUrl() : null);
        }

        return builder.build();
    }
}
