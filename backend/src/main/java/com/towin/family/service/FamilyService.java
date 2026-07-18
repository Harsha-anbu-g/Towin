package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.common.service.UserIdentifierResolver;
import com.towin.family.dto.FamilyAlertResponse;
import com.towin.family.dto.FamilyAlertsResponse;
import com.towin.family.dto.FamilyLinkResponse;
import com.towin.family.dto.FamilyLinksResponse;
import com.towin.family.dto.FamilyRequest;
import com.towin.family.entity.FamilyAlert;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyAlertRepository;
import com.towin.family.repository.FamilyLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FamilyService {

    /** Max family members per elder, counting PENDING + ACTIVE (user decision). */
    static final int MAX_FAMILY_PER_ELDER = 5;
    /** Mirrors the connection-request daily cap. */
    static final int MAX_REQUESTS_PER_DAY = 10;

    // Generic on purpose: the same message covers "no such account" and "that
    // account can't take the elder seat", so identifiers can't be probed for
    // account existence or role (no enumeration).
    private static final String NOT_FOUND_MESSAGE = "We couldn't find that person";

    private final FamilyLinkRepository familyLinkRepository;
    private final FamilyAlertRepository familyAlertRepository;
    private final UserRepository userRepository;
    private final TrustScoreService trustScoreService;

    @Transactional
    public FamilyLinkResponse createRequest(UUID callerId, FamilyRequest request) {
        boolean targetIsFamilySeat = switch (request.getSide()) {
            case "family" -> true;
            case "elder" -> false;
            default -> throw new IllegalArgumentException("Invalid request.");
        };

        User caller = getUser(callerId);
        if (targetIsFamilySeat && !hasElderSeat(caller)) {
            // Links always hang off an elder — a helper can never attach family
            // to their own account (closes the fake-family door structurally).
            throw new IllegalArgumentException("Only elders can add family members");
        }

        User target = UserIdentifierResolver.resolve(userRepository, request.getIdentifier().trim())
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND_MESSAGE));
        if (target.getId().equals(callerId)) {
            throw new IllegalArgumentException("You can't add yourself as family");
        }
        if (!targetIsFamilySeat && !hasElderSeat(target)) {
            throw new IllegalArgumentException(NOT_FOUND_MESSAGE);
        }

        User elder = targetIsFamilySeat ? caller : target;
        User familyUser = targetIsFamilySeat ? target : caller;

        Optional<FamilyLink> existing =
                familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), familyUser.getId());
        existing.ifPresent(link -> {
            if (link.getStatus() == FamilyLinkStatus.PENDING || link.getStatus() == FamilyLinkStatus.ACTIVE) {
                throw new IllegalArgumentException("A family request already exists between you two");
            }
        });

        long taken = familyLinkRepository.countByElderIdAndStatusIn(
                elder.getId(), List.of(FamilyLinkStatus.PENDING, FamilyLinkStatus.ACTIVE));
        if (taken >= MAX_FAMILY_PER_ELDER) {
            throw new IllegalArgumentException("Family limit reached");
        }

        long sentToday = familyLinkRepository.countByInitiatedByIdAndCreatedAtAfter(
                callerId, LocalDateTime.now().minusDays(1));
        if (sentToday >= MAX_REQUESTS_PER_DAY) {
            throw new IllegalArgumentException("Daily family request limit reached");
        }

        // UNIQUE(elder_id, family_user_id) allows only one row per pair, so a
        // DECLINED/REVOKED pair is re-requested by resetting the existing row.
        FamilyLink link = existing.orElseGet(() -> FamilyLink.builder()
                .elder(elder)
                .familyUser(familyUser)
                .build());
        link.setInitiatedBy(caller);
        link.setRelationship(request.getRelationship());
        link.setStatus(FamilyLinkStatus.PENDING);
        link.setIsPrimary(false);
        link.setRespondedAt(null);
        link.setRevokedAt(null);

        return toResponse(familyLinkRepository.save(link), callerId);
    }

    @Transactional
    public FamilyLinkResponse respond(UUID callerId, UUID linkId, boolean accept) {
        FamilyLink link = getLink(linkId);
        requireParticipant(link, callerId);
        if (link.getInitiatedBy().getId().equals(callerId)) {
            throw new IllegalArgumentException("You can't respond to your own family request");
        }
        if (link.getStatus() != FamilyLinkStatus.PENDING) {
            throw new IllegalArgumentException("This family request is no longer pending");
        }

        link.setStatus(accept ? FamilyLinkStatus.ACTIVE : FamilyLinkStatus.DECLINED);
        link.setRespondedAt(LocalDateTime.now());
        FamilyLinkResponse response = toResponse(familyLinkRepository.save(link), callerId);
        if (accept) {
            // US-008: the elder earns +1 per ACTIVE link (recompute model).
            trustScoreService.recalculate(link.getElder().getId());
        }
        return response;
    }

    @Transactional
    public void revoke(UUID callerId, UUID linkId) {
        FamilyLink link = getLink(linkId);
        requireParticipant(link, callerId);
        boolean wasActive = link.getStatus() == FamilyLinkStatus.ACTIVE;
        switch (link.getStatus()) {
            case ACTIVE -> {
                // Elder revokes; family member unlinks themself. Both are participants.
            }
            case PENDING -> {
                boolean isElder = link.getElder().getId().equals(callerId);
                boolean isInitiator = link.getInitiatedBy().getId().equals(callerId);
                // Elder revokes any link; otherwise only the sender may cancel
                // (the receiving family member declines via respond instead).
                if (!isElder && !isInitiator) {
                    throw new IllegalArgumentException("Only the person who sent this request can cancel it");
                }
            }
            default -> throw new IllegalArgumentException("This family link has already ended");
        }

        link.setStatus(FamilyLinkStatus.REVOKED);
        link.setRevokedAt(LocalDateTime.now());
        link.setIsPrimary(false);
        familyLinkRepository.save(link);
        if (wasActive) {
            // US-008: revoked links stop counting — recompute drops the point.
            trustScoreService.recalculate(link.getElder().getId());
        }
    }

    @Transactional
    public FamilyLinkResponse setPrimary(UUID callerId, UUID linkId) {
        FamilyLink link = getLink(linkId);
        if (!link.getElder().getId().equals(callerId)) {
            throw new IllegalArgumentException("Only the elder can choose the main contact");
        }
        if (link.getStatus() != FamilyLinkStatus.ACTIVE) {
            throw new IllegalArgumentException("Only an accepted family member can be the main contact");
        }

        // Clear and FLUSH the old primary before setting the new one, so the
        // partial unique index (one ACTIVE primary per elder) never sees two.
        familyLinkRepository.findByElderIdAndStatus(callerId, FamilyLinkStatus.ACTIVE).stream()
                .filter(l -> Boolean.TRUE.equals(l.getIsPrimary()) && !l.getId().equals(linkId))
                .forEach(l -> {
                    l.setIsPrimary(false);
                    familyLinkRepository.saveAndFlush(l);
                });

        link.setIsPrimary(true);
        return toResponse(familyLinkRepository.save(link), callerId);
    }

    @Transactional(readOnly = true)
    public FamilyLinksResponse getLinks(UUID callerId) {
        List<FamilyLink> active = new ArrayList<>();
        active.addAll(familyLinkRepository.findByElderIdAndStatus(callerId, FamilyLinkStatus.ACTIVE));
        active.addAll(familyLinkRepository.findByFamilyUserIdAndStatus(callerId, FamilyLinkStatus.ACTIVE));

        List<FamilyLink> pending =
                familyLinkRepository.findByParticipantAndStatus(callerId, FamilyLinkStatus.PENDING);

        return FamilyLinksResponse.builder()
                .activeLinks(toResponses(active, callerId))
                .incomingRequests(toResponses(pending.stream()
                        .filter(l -> !l.getInitiatedBy().getId().equals(callerId)).toList(), callerId))
                .outgoingRequests(toResponses(pending.stream()
                        .filter(l -> l.getInitiatedBy().getId().equals(callerId)).toList(), callerId))
                .build();
    }

    @Transactional(readOnly = true)
    public FamilyAlertsResponse getAlerts(UUID callerId) {
        List<UUID> elderIds = familyLinkRepository
                .findByFamilyUserIdAndStatus(callerId, FamilyLinkStatus.ACTIVE).stream()
                .map(link -> link.getElder().getId())
                .toList();
        if (elderIds.isEmpty()) {
            return FamilyAlertsResponse.builder().alerts(List.of()).build();
        }
        List<FamilyAlertResponse> alerts = familyAlertRepository
                .findByElderIdInOrderByCreatedAtDesc(elderIds).stream()
                .map(this::toAlertResponse)
                .toList();
        return FamilyAlertsResponse.builder().alerts(alerts).build();
    }

    private FamilyAlertResponse toAlertResponse(FamilyAlert alert) {
        User elder = alert.getElder();
        String elderName = elder.getFullName() != null && !elder.getFullName().isBlank()
                ? elder.getFullName() : elder.getUsername();
        return FamilyAlertResponse.builder()
                .id(alert.getId())
                .elderId(elder.getId())
                .elderName(elderName)
                .type(alert.getType())
                .body(alert.getBody())
                .createdAt(alert.getCreatedAt())
                .build();
    }

    private boolean hasElderSeat(User user) {
        return user.getRole() == UserRole.ELDER || user.getRole() == UserRole.BOTH;
    }

    private FamilyLink getLink(UUID linkId) {
        // "not found" (lowercase) is mapped to a 404 by GlobalExceptionHandler.
        return familyLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Family link not found"));
    }

    private void requireParticipant(FamilyLink link, UUID userId) {
        if (!link.getElder().getId().equals(userId) && !link.getFamilyUser().getId().equals(userId)) {
            throw new IllegalArgumentException("You are not part of this family link");
        }
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }

    private List<FamilyLinkResponse> toResponses(List<FamilyLink> links, UUID viewerUserId) {
        return links.stream().map(l -> toResponse(l, viewerUserId)).toList();
    }

    private FamilyLinkResponse toResponse(FamilyLink link, UUID viewerUserId) {
        boolean iAmElder = link.getElder().getId().equals(viewerUserId);
        User other = iAmElder ? link.getFamilyUser() : link.getElder();
        return FamilyLinkResponse.builder()
                .id(link.getId())
                .elderId(link.getElder().getId())
                .familyUserId(link.getFamilyUser().getId())
                .otherUserId(other.getId())
                .otherUserName(other.getUsername())
                .relationship(link.getRelationship())
                .isPrimary(link.getIsPrimary())
                .status(link.getStatus())
                .initiatedByMe(link.getInitiatedBy().getId().equals(viewerUserId))
                .iAmElder(iAmElder)
                .createdAt(link.getCreatedAt())
                .respondedAt(link.getRespondedAt())
                .build();
    }
}
