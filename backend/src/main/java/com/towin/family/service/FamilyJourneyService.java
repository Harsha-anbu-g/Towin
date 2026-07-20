package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.NeedStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.service.DisplayNameResolver;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.dto.FamilyJourneyResponse;
import com.towin.family.dto.FamilyJourneyResponse.ElderJourney;
import com.towin.family.dto.FamilyJourneyResponse.SharedHelper;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.streak.repository.UserStreakRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Step 2: read-only composition of the parent's trust journey for linked
 * family. Locked rules (2026-07-18 plan):
 *  - a connection appears iff status ACTIVE and shared_with_family — private
 *    friendships are entirely absent, never greyed or counted;
 *  - no phone/email/social details ever cross to family;
 *  - check-in + open-needs are elder-level (like SOS) and ignore share switches;
 *  - PENDING/REVOKED family links contribute nothing.
 */
@Service
@RequiredArgsConstructor
public class FamilyJourneyService {

    private final FamilyLinkRepository familyLinkRepository;
    private final ConnectionRepository connectionRepository;
    private final UserStreakRepository streakRepository;
    private final NeedRepository needRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final S3Service s3Service;

    @Transactional(readOnly = true)
    public FamilyJourneyResponse getJourney(UUID callerId) {
        List<ElderJourney> elders = familyLinkRepository
                .findByFamilyUserIdAndStatus(callerId, FamilyLinkStatus.ACTIVE).stream()
                .map(link -> toElderJourney(link.getElder()))
                .toList();
        return FamilyJourneyResponse.builder().elders(elders).build();
    }

    private ElderJourney toElderJourney(User elder) {
        boolean checkedInToday = streakRepository.findByUserId(elder.getId())
                .map(s -> LocalDate.now().equals(s.getLastCheckinDate()))
                .orElse(false);

        // The parent's OPEN help requests, read-only for family (no applicant data).
        List<FamilyJourneyResponse.OpenNeed> openNeeds = needRepository
                .findByElderIdAndStatusOrderByCreatedAtDesc(elder.getId(), NeedStatus.OPEN).stream()
                .map(n -> FamilyJourneyResponse.OpenNeed.builder()
                        .id(n.getId())
                        .title(n.getTitle())
                        .category(n.getCategory() == null ? null : n.getCategory().name())
                        .description(n.getDescription())
                        .createdAt(n.getCreatedAt())
                        .build())
                .toList();

        List<SharedHelper> sharedHelpers = connectionRepository
                .findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE).stream()
                .filter(c -> Boolean.TRUE.equals(c.getSharedWithFamily()))
                .map(c -> toSharedHelper(c, elder.getId()))
                .toList();

        return ElderJourney.builder()
                .elderId(elder.getId())
                .elderName(displayName(elder))
                .elderPhotoUrl(photoUrl(elder))
                .checkedInToday(checkedInToday)
                .openNeedsCount(openNeeds.size())
                .openNeeds(openNeeds)
                .sharedHelpers(sharedHelpers)
                .build();
    }

    private SharedHelper toSharedHelper(Connection connection, UUID elderId) {
        User helper = connection.getOtherUser(elderId);
        TrustLevel level = connection.getCurrentTrustLevel();
        int score = helper.getTrustScore() == null ? 0
                : (int) Math.round(helper.getTrustScore());
        return SharedHelper.builder()
                .helperUserId(helper.getId())
                .connectionId(connection.getId())
                .helperName(displayName(helper))
                .helperPhotoUrl(photoUrl(helper))
                .trustScore(score)
                .tier(TrustScoreService.tierFor(score))
                .stageIndex(level.getValue())
                .stageLabel(stageLabel(level))
                .currentTrustLevel(level.name())
                .readyToMeet(level == TrustLevel.FIRST_MEET)
                .build();
    }

    /** The exact ladder words the elder sees (frontend TrustJourney stages). */
    private String stageLabel(TrustLevel level) {
        switch (level) {
            case MESSAGING:  return "Messaging";
            case PHONE_CALL: return "Phone Ready";
            case VIDEO_CALL: return "Video Ready";
            case VERIFIED:   return "Social Media";
            case FIRST_MEET: return "Ready to Meet";
            case TRUSTED:    return "Fully Trusted";
            case DISCOVERED:
            default:         return "Just Connected";
        }
    }

    private String displayName(User user) {
        return DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, user);
    }

    private String photoUrl(User user) {
        return elderProfileRepository.findByUserId(user.getId()).map(ElderProfile::getPhotoUrl)
                .or(() -> helperProfileRepository.findByUserId(user.getId()).map(HelperProfile::getPhotoUrl))
                .filter(this::notBlank)
                .map(s3Service::presignedUrl)
                .orElse(null);
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
