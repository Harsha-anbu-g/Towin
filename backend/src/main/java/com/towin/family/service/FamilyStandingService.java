package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.FamilyStandingState;
import com.towin.common.enums.TrustLevel;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.dto.ElderTransparencyResponse;
import com.towin.family.dto.FamilyStandingsResponse;
import com.towin.family.dto.FamilyStandingsResponse.Standing;
import com.towin.family.entity.FamilyLink;
import com.towin.family.entity.FamilyStandingControl;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.family.repository.FamilyStandingControlRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Trust inheritance (user decision 2026-07-19): the elder's earned trust is the
 * bridge for family↔helper contact. A standing is DERIVED, never stored:
 *
 *   ACTIVE family link + elder's connection ACTIVE + shared_with_family
 *   + level ≥ MESSAGING + no REVOKED control row.
 *
 * Fully automatic — no request, no accept, for anyone. The elder's share
 * switch stays the single consent gate: flipping it off makes the standing
 * vanish on the next read because nothing is persisted. The family member's
 * only stored state is their own opt-out (pause/revoke) in
 * family_standing_controls.
 */
@Service
@RequiredArgsConstructor
public class FamilyStandingService {

    private final FamilyLinkRepository familyLinkRepository;
    private final ConnectionRepository connectionRepository;
    private final FamilyStandingControlRepository controlRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final S3Service s3Service;

    @Transactional(readOnly = true)
    public FamilyStandingsResponse standingsFor(UUID familyUserId) {
        List<Standing> standings = new ArrayList<>();
        familyLinkRepository.findByFamilyUserIdAndStatus(familyUserId, FamilyLinkStatus.ACTIVE)
                .forEach(link -> collectStandings(familyUserId, link.getElder(), standings));
        return FamilyStandingsResponse.builder().standings(standings).build();
    }

    /** The derivation for one elder↔helper connection, or null if no standing. */
    @Transactional(readOnly = true)
    public Standing standingFor(UUID familyUserId, UUID elderConnectionId) {
        Connection c = connectionRepository.findById(elderConnectionId).orElse(null);
        if (c == null) return null;
        for (User participant : List.of(c.getUserA(), c.getUserB())) {
            boolean linked = familyLinkRepository
                    .findByElderIdAndFamilyUserId(participant.getId(), familyUserId)
                    .filter(l -> l.getStatus() == FamilyLinkStatus.ACTIVE)
                    .isPresent();
            if (linked) return toStanding(familyUserId, participant, c);
        }
        return null;
    }

    private void collectStandings(UUID familyUserId, User elder, List<Standing> out) {
        connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE).stream()
                .map(c -> toStanding(familyUserId, elder, c))
                .filter(s -> s != null)
                .forEach(out::add);
    }

    private Standing toStanding(UUID familyUserId, User elder, Connection c) {
        // FAMILY-type rows are coordination chats, not trust journeys to inherit.
        if (c.getType() == ConnectionType.FAMILY) return null;
        if (c.getStatus() != ConnectionStatus.ACTIVE) return null;
        if (!Boolean.TRUE.equals(c.getSharedWithFamily())) return null;
        if (c.getCurrentTrustLevel().getValue() < TrustLevel.MESSAGING.getValue()) return null;

        FamilyStandingState state = controlRepository
                .findByFamilyUserIdAndElderConnectionId(familyUserId, c.getId())
                .map(FamilyStandingControl::getState)
                .orElse(null);
        if (state == FamilyStandingState.REVOKED) return null;

        User helper = c.getOtherUser(elder.getId());
        UUID chatConnectionId = connectionRepository
                .findBetweenUsers(familyUserId, helper.getId())
                .filter(fc -> fc.getType() == ConnectionType.FAMILY
                        && fc.getStatus() == ConnectionStatus.ACTIVE)
                .map(Connection::getId)
                .orElse(null);

        return Standing.builder()
                .standingConnectionId(c.getId())
                .elderName(displayName(elder))
                .helperUserId(helper.getId())
                .helperName(displayName(helper))
                .helperPhotoUrl(photoUrl(helper))
                .stageLabel(stageLabel(c.getCurrentTrustLevel()))
                .stageIndex(c.getCurrentTrustLevel().getValue())
                .paused(state == FamilyStandingState.PAUSED)
                .chatConnectionId(chatConnectionId)
                .build();
    }

    /**
     * Open (or reopen) the family↔helper chat behind a standing. Creates the
     * ACTIVE FAMILY-type connection on first use — no request, no accept
     * (user decision 2026-07-19). Paused standings must resume first.
     */
    @Transactional
    public UUID materializeChat(UUID familyUserId, UUID standingConnectionId) {
        Standing standing = standingFor(familyUserId, standingConnectionId);
        if (standing == null) {
            throw new IllegalStateException("This friendship isn't shared for family chat right now");
        }
        if (standing.isPaused()) {
            throw new IllegalStateException("You paused this chat. Resume it to send messages again");
        }
        if (standing.getChatConnectionId() != null) return standing.getChatConnectionId();

        User familyUser = userRepository.findById(familyUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User helper = userRepository.findById(standing.getHelperUserId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Connection existing = connectionRepository.findBetweenUsers(familyUserId, helper.getId()).orElse(null);
        // If the two already share a LIVE non-FAMILY connection (they connected on
        // their own), that is a real relationship — never overwrite it into a
        // coordination chat. Just hand back the conversation they already have.
        // A terminal row (declined/ended) falls through and is reopened as the
        // FAMILY chat, so the Message button never dead-ends on a dead connection.
        if (existing != null && existing.getType() != ConnectionType.FAMILY
                && existing.getStatus() == ConnectionStatus.ACTIVE) {
            return existing.getId();
        }
        // A previous revoke may have left an ENDED FAMILY row (or a terminal
        // non-FAMILY row) — reopen it instead of violating the one-row-per-pair
        // shape the rest of the app assumes.
        Connection chat = existing != null ? existing : Connection.builder()
                .userA(familyUser)
                .userB(helper)
                .initiatedBy(familyUser)
                .requestMessage("Family of " + standing.getElderName())
                .build();
        chat.setType(ConnectionType.FAMILY);
        chat.setStatus(ConnectionStatus.ACTIVE);
        if (chat.getCurrentTrustLevel() == null) chat.setCurrentTrustLevel(TrustLevel.DISCOVERED);
        return connectionRepository.save(chat).getId();
    }

    /** Pause or revoke (family side); state == null resumes a paused standing. */
    @Transactional
    public void setControl(UUID familyUserId, UUID standingConnectionId, FamilyStandingState state) {
        Connection elderConnection = connectionRepository.findById(standingConnectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found"));
        if (standingFor(familyUserId, standingConnectionId) == null
                && controlRepository.findByFamilyUserIdAndElderConnectionId(familyUserId, standingConnectionId).isEmpty()) {
            throw new IllegalStateException("This friendship isn't shared for family chat right now");
        }

        var existing = controlRepository.findByFamilyUserIdAndElderConnectionId(familyUserId, standingConnectionId);
        if (state == null) {
            existing.ifPresent(controlRepository::delete);
        } else {
            FamilyStandingControl control = existing.orElseGet(() -> FamilyStandingControl.builder()
                    .familyUser(userRepository.findById(familyUserId)
                            .orElseThrow(() -> new IllegalArgumentException("User not found")))
                    .elderConnection(elderConnection)
                    .build());
            control.setState(state);
            controlRepository.save(control);
        }

        if (state == FamilyStandingState.REVOKED) {
            // Revoking also closes any open chat with that helper.
            UUID elderId = elderIdFor(familyUserId, elderConnection);
            if (elderId != null) {
                User helper = elderConnection.getOtherUser(elderId);
                connectionRepository.findBetweenUsers(familyUserId, helper.getId())
                        .filter(fc -> fc.getType() == ConnectionType.FAMILY)
                        .ifPresent(fc -> {
                            fc.setStatus(ConnectionStatus.ENDED);
                            connectionRepository.save(fc);
                        });
            }
        }
    }

    /**
     * Send-time gate for FAMILY-type chats: the message may pass only while a
     * live standing still bridges the two people, in either orientation. The
     * elder flipping the share switch off, trust dropping, or a family-side
     * pause/revoke closes the chat immediately — nothing is cached.
     */
    @Transactional(readOnly = true)
    public boolean chatAllowed(Connection familyConnection) {
        return bridgeExists(familyConnection.getUserA(), familyConnection.getUserB())
                || bridgeExists(familyConnection.getUserB(), familyConnection.getUserA());
    }

    private boolean bridgeExists(User familySide, User helperSide) {
        return familyLinkRepository.findByFamilyUserIdAndStatus(familySide.getId(), FamilyLinkStatus.ACTIVE)
                .stream()
                .anyMatch(link -> connectionRepository
                        .findByUserAndStatus(link.getElder().getId(), ConnectionStatus.ACTIVE).stream()
                        .filter(c -> c.getOtherUser(link.getElder().getId()).getId().equals(helperSide.getId()))
                        .anyMatch(c -> toStanding(familySide.getId(), link.getElder(), c) != null
                                && !isPaused(familySide.getId(), c.getId())));
    }

    private boolean isPaused(UUID familyUserId, UUID elderConnectionId) {
        return controlRepository.findByFamilyUserIdAndElderConnectionId(familyUserId, elderConnectionId)
                .map(ctrl -> ctrl.getState() == FamilyStandingState.PAUSED)
                .orElse(false);
    }

    private UUID elderIdFor(UUID familyUserId, Connection elderConnection) {
        for (User participant : List.of(elderConnection.getUserA(), elderConnection.getUserB())) {
            boolean linked = familyLinkRepository
                    .findByElderIdAndFamilyUserId(participant.getId(), familyUserId)
                    .filter(l -> l.getStatus() == FamilyLinkStatus.ACTIVE)
                    .isPresent();
            if (linked) return participant.getId();
        }
        return null;
    }

    /**
     * Elder transparency (locked rule: nothing family-facing is hidden from the
     * elder): every helper each family member can reach — opened chats first,
     * plus standings they hold through the elder's shared trust.
     */
    @Transactional(readOnly = true)
    public ElderTransparencyResponse transparency(UUID elderId) {
        List<ElderTransparencyResponse.Row> rows = new ArrayList<>();
        for (FamilyLink link : familyLinkRepository.findByElderIdAndStatus(elderId, FamilyLinkStatus.ACTIVE)) {
            User familyMember = link.getFamilyUser();
            Set<UUID> chattingHelpers = new HashSet<>();
            for (Connection c : connectionRepository.findByUserAndStatus(familyMember.getId(), ConnectionStatus.ACTIVE)) {
                if (c.getType() != ConnectionType.FAMILY) continue;
                User other = c.getOtherUser(familyMember.getId());
                chattingHelpers.add(other.getId());
                rows.add(ElderTransparencyResponse.Row.builder()
                        .familyMemberName(plainName(familyMember))
                        .relationship(link.getRelationship())
                        .helperUserId(other.getId())
                        .helperName(displayName(other))
                        .inherited(false)
                        .build());
            }
            for (Connection c : connectionRepository.findByUserAndStatus(elderId, ConnectionStatus.ACTIVE)) {
                Standing s = toStanding(familyMember.getId(), link.getElder(), c);
                if (s == null || chattingHelpers.contains(s.getHelperUserId())) continue;
                rows.add(ElderTransparencyResponse.Row.builder()
                        .familyMemberName(plainName(familyMember))
                        .relationship(link.getRelationship())
                        .helperUserId(s.getHelperUserId())
                        .helperName(s.getHelperName())
                        .inherited(true)
                        .build());
            }
        }
        return ElderTransparencyResponse.builder().connections(rows).build();
    }

    private String plainName(User user) {
        return notBlank(user.getFullName()) ? user.getFullName() : user.getUsername();
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
        return elderProfileRepository.findByUserId(user.getId()).map(ElderProfile::getName)
                .or(() -> helperProfileRepository.findByUserId(user.getId()).map(HelperProfile::getName))
                .filter(this::notBlank)
                .orElseGet(() -> notBlank(user.getFullName()) ? user.getFullName() : user.getUsername());
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
