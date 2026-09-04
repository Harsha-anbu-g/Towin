package com.towinly.family.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.DelegatedPower;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.common.service.TrustScoreService;
import com.towinly.common.service.UserIdentifierResolver;
import com.towinly.family.dto.FamilyAlertResponse;
import com.towinly.family.dto.FamilyAlertsResponse;
import com.towinly.family.dto.FamilyLinkResponse;
import com.towinly.family.dto.FamilyLinksResponse;
import com.towinly.family.dto.FamilyRequest;
import com.towinly.family.entity.FamilyAlert;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyAlertRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.block.service.BlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FamilyService {

    /** Max family members per elder, counting PENDING + ACTIVE (user decision). */
    static final int MAX_FAMILY_PER_ELDER = 5;
    /** Mirrors the connection-request daily cap. */
    static final int MAX_REQUESTS_PER_DAY = 10;

    // Generic on purpose: the same message covers "no such account" and "that
    // account can't take the elder seat", so a caller can't tell a typo from a
    // wrong-role member. What it CAN'T hide — that some identifier resolved and
    // some didn't — is throttled instead: every failed lookup burns the caller's
    // daily budget (FamilyLookupRateLimiter), so this endpoint can't be used to
    // run a list of emails or phone numbers through the member directory.
    private static final String NOT_FOUND_MESSAGE = "We couldn't find that person";

    private final FamilyLinkRepository familyLinkRepository;
    private final FamilyAlertRepository familyAlertRepository;
    private final UserRepository userRepository;
    private final TrustScoreService trustScoreService;
    private final FamilyDelegationService familyDelegationService;
    private final com.towinly.profile.repository.ElderProfileRepository elderProfileRepository;
    private final com.towinly.profile.repository.HelperProfileRepository helperProfileRepository;
    // Unlinking ends a Keyholder's key too. See the note in revoke().
    private final com.towinly.passon.service.KeyholderService keyholderService;
    private final BlockService blockService;
    private final FamilyLookupRateLimiter lookupRateLimiter;

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

        // The caller's OWN throttles are evaluated before the target is resolved
        // (SEC-08). A capped caller is answered the same way for every identifier,
        // and the lookup limiter alongside means failed probes are not free either
        // — so a list of identifiers cannot be run through this endpoint at scale.
        requireCallerUnderDailyCap(callerId);
        lookupRateLimiter.check(callerId);
        if (targetIsFamilySeat) {
            // The elder seat is the caller here, so their family cap is caller-owned.
            requireElderUnderFamilyCap(caller.getId());
        }

        // A miss is answered plainly — the shipped apps toast success on any 2xx,
        // so a silent acknowledgement here turned an elder's typo into "Request
        // sent" followed by a list that never changes. The enumeration risk the
        // silent answer carried is paid for above instead: every failed lookup
        // counts against the caller's daily budget.
        User target = UserIdentifierResolver.resolve(userRepository, request.getIdentifier().trim())
                .orElseThrow(() -> failedLookup(callerId));
        if (target.getId().equals(callerId)) {
            throw new IllegalArgumentException("You can't add yourself as family");
        }
        if (!targetIsFamilySeat && !hasElderSeat(target)) {
            // Same words as "no such account", so role can't be told apart from absence.
            throw failedLookup(callerId);
        }
        // HARD-106: a block in either direction stops a family request too, with the
        // same sentence every other refused write uses (it names no block).
        if (blockService.isHidden(callerId, target.getId())) {
            lookupRateLimiter.recordFailure(callerId);
            throw new IllegalStateException(BlockService.NOT_AVAILABLE);
        }

        User elder = targetIsFamilySeat ? caller : target;
        User familyUser = targetIsFamilySeat ? target : caller;

        Optional<FamilyLink> existing =
                familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), familyUser.getId());
        if (existing.filter(l -> l.getStatus() == FamilyLinkStatus.PENDING
                || l.getStatus() == FamilyLinkStatus.ACTIVE).isPresent()) {
            // A live or pending link already shows in the caller's own family list,
            // so naming it confirms nothing they cannot already see.
            throw new IllegalArgumentException("A family request already exists between you two");
        }

        if (!targetIsFamilySeat) {
            // Here the elder seat is the TARGET. A full elder is named as full — the
            // sender must know their request cannot land — and the answer, which
            // does confirm an account exists, burns lookup budget like any probe.
            long taken = familyLinkRepository.countByElderIdAndStatusIn(
                    elder.getId(), List.of(FamilyLinkStatus.PENDING, FamilyLinkStatus.ACTIVE));
            if (taken >= MAX_FAMILY_PER_ELDER) {
                lookupRateLimiter.recordFailure(callerId);
                throw new IllegalArgumentException("Family limit reached");
            }
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
        // The full response, id and name included: the shipped apps and any client
        // reading the returned link back depend on the real row.
        return toResponse(familyLinkRepository.save(link), callerId);
    }

    /** A failed identifier lookup: counted against the caller's daily budget, then refused. */
    private IllegalArgumentException failedLookup(UUID callerId) {
        lookupRateLimiter.recordFailure(callerId);
        return new IllegalArgumentException(NOT_FOUND_MESSAGE);
    }

    private void requireCallerUnderDailyCap(UUID callerId) {
        long sentToday = familyLinkRepository.countByInitiatedByIdAndCreatedAtAfter(
                callerId, LocalDateTime.now().minusDays(1));
        if (sentToday >= MAX_REQUESTS_PER_DAY) {
            throw new IllegalArgumentException("Daily family request limit reached");
        }
    }

    private void requireElderUnderFamilyCap(UUID elderId) {
        long taken = familyLinkRepository.countByElderIdAndStatusIn(
                elderId, List.of(FamilyLinkStatus.PENDING, FamilyLinkStatus.ACTIVE));
        if (taken >= MAX_FAMILY_PER_ELDER) {
            throw new IllegalArgumentException("Family limit reached");
        }
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
        // Unlinking ends consent: clear every granted power and open ask for
        // this pair, or a later re-link would silently resurrect old grants
        // the elder never re-approved.
        familyDelegationService.revokeAll(link.getElder().getId(), link.getFamilyUser().getId());
        // ...and it ends their key to the elder's Sealed box, from either side. Two
        // "remove this person" buttons with two different consequences is a trap an elder
        // cannot be expected to understand, so there is only ever one.
        keyholderService.onFamilyLinkEnded(link.getElder().getId(), link.getFamilyUser().getId());
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
        // An ACTIVE FamilyLink survives a block, so without this the SOS, inactivity
        // and Sealed-box alerts of an elder the caller has blocked (in either
        // direction) still streamed to that caller. Filter the ELDER side of the
        // link — the pair the block is actually between — exactly as
        // FamilyJourneyService.getJourney and FamilyStandingService.standingsFor do.
        // Never filter on anyone NAMED inside an alert body: that would be a third
        // party's block reaching into this caller's oversight of their own parent.
        Set<UUID> hidden = blockService.hiddenFor(callerId);
        List<UUID> elderIds = familyLinkRepository
                .findByFamilyUserIdAndStatus(callerId, FamilyLinkStatus.ACTIVE).stream()
                .map(link -> link.getElder().getId())
                .filter(elderId -> !hidden.contains(elderId))
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
        String elderName = DisplayNameResolver.fromUser(elder);
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

    /** The person's real display name — their profile name (Margaret), then their
     *  full name. Family should see "Margaret", never the login handle "elder". */
    private String displayName(User user) {
        return DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, user);
    }

    /**
     * The parent decides what this family member may do for them. The delegation
     * service does the checking (elder seat, active link) and the reconciling;
     * this just hands back the link so the screen shows the new state at once.
     */
    @Transactional
    public FamilyLinkResponse setDelegatedPowers(UUID callerId, UUID linkId, Set<DelegatedPower> powers) {
        familyDelegationService.setPowers(callerId, linkId, powers);
        FamilyLink link = familyLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Family link not found"));
        return toResponse(link, callerId);
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
                .otherUserName(displayName(other))
                .relationship(link.getRelationship())
                .isPrimary(link.getIsPrimary())
                .status(link.getStatus())
                .initiatedByMe(link.getInitiatedBy().getId().equals(viewerUserId))
                .iAmElder(iAmElder)
                .createdAt(link.getCreatedAt())
                .respondedAt(link.getRespondedAt())
                // Only an active link can carry powers; a pending or revoked one
                // reports an empty set so a stale grant is never shown as live.
                .delegatedPowers(link.getStatus() == FamilyLinkStatus.ACTIVE
                        ? familyDelegationService.grantedPowers(link.getElder().getId(), link.getFamilyUser().getId())
                        : EnumSet.noneOf(DelegatedPower.class))
                // Consent flow: open asks ride the same payload — the elder's
                // approval cards and the family side's waiting state both read
                // this, so neither screen needs another fetch.
                .pendingPowerRequests(link.getStatus() == FamilyLinkStatus.ACTIVE
                        ? familyDelegationService.pendingRequests(link.getElder().getId(), link.getFamilyUser().getId()).stream()
                                .map(r -> FamilyLinkResponse.PendingPowerRequest.builder()
                                        .id(r.getId())
                                        .power(r.getPower())
                                        .build())
                                .toList()
                        : List.of())
                .build();
    }
}
