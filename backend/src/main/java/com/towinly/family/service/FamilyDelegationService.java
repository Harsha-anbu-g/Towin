package com.towinly.family.service;

import com.towinly.common.enums.DelegatedPower;
import com.towinly.connection.entity.Connection;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.PowerRequestStatus;
import com.towinly.common.exception.ForbiddenException;
import com.towinly.family.entity.FamilyDelegatedPower;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.entity.FamilyPowerRequest;
import com.towinly.family.repository.FamilyDelegatedPowerRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.family.repository.FamilyPowerRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Guardian mode (2026-07-19): an elder delegates specific powers to ONE trusted
 * family member. This service owns the grant record and the single gate every
 * delegated action re-checks at execution time.
 *
 * Locked rules: only the elder seat of an ACTIVE link may grant/revoke; a family
 * member can never grant themselves anything; the grant is stored server-side
 * (never asserted by the client); flipping a power off cuts the ability on the
 * very next action because every action calls {@link #assertDelegated}.
 */
@Service
@RequiredArgsConstructor
public class FamilyDelegationService {

    private final FamilyDelegatedPowerRepository powerRepository;
    private final FamilyLinkRepository familyLinkRepository;
    private final FamilyPowerRequestRepository requestRepository;

    /** How long a family member waits to re-ask after ANY answered request —
     *  declines throttle nagging, and approve-then-revoke is throttled too. */
    static final int REQUEST_COOLDOWN_DAYS = 7;

    /** The powers this elder has delegated to this family member. */
    @Transactional(readOnly = true)
    public Set<DelegatedPower> grantedPowers(UUID elderId, UUID familyUserId) {
        Set<DelegatedPower> powers = EnumSet.noneOf(DelegatedPower.class);
        powerRepository.findByElderIdAndFamilyUserId(elderId, familyUserId)
                .forEach(p -> powers.add(p.getPower()));
        return powers;
    }

    /**
     * Elder reconciles the full power set for one family member (grant + revoke in
     * one call). Only the elder seat of an ACTIVE link may do this.
     */
    @Transactional
    public Set<DelegatedPower> setPowers(UUID callerId, UUID linkId, Set<DelegatedPower> desired) {
        FamilyLink link = familyLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Family link not found"));
        if (!link.getElder().getId().equals(callerId)) {
            throw new ForbiddenException("Only the parent can decide who may help them");
        }
        if (link.getStatus() != FamilyLinkStatus.ACTIVE) {
            throw new IllegalStateException("You can only delegate to an active family member");
        }
        UUID elderId = link.getElder().getId();
        UUID familyUserId = link.getFamilyUser().getId();
        Set<DelegatedPower> current = grantedPowers(elderId, familyUserId);
        // EnumSet.copyOf throws on an empty non-EnumSet collection, and "revoke
        // everything" arrives from the client as exactly that (an empty list).
        Set<DelegatedPower> want = (desired == null || desired.isEmpty())
                ? EnumSet.noneOf(DelegatedPower.class)
                : EnumSet.copyOf(desired);

        for (DelegatedPower p : current) {
            if (!want.contains(p)) powerRepository.deleteByElderIdAndFamilyUserIdAndPower(elderId, familyUserId, p);
        }
        for (DelegatedPower p : want) {
            if (!current.contains(p)) {
                powerRepository.save(FamilyDelegatedPower.builder()
                        .elder(link.getElder())
                        .familyUser(link.getFamilyUser())
                        .power(p)
                        .build());
                // A direct grant answers an open ask for the same power — the
                // approval card must not linger once the switch is already on.
                requestRepository.findByElderIdAndFamilyUserIdAndPowerAndStatus(
                                elderId, familyUserId, p, PowerRequestStatus.PENDING)
                        .ifPresent(r -> {
                            r.setStatus(PowerRequestStatus.APPROVED);
                            r.setRespondedAt(LocalDateTime.now());
                            requestRepository.save(r);
                        });
            }
        }
        return want;
    }

    /** True if the caller currently holds this power for this elder (ACTIVE link + granted). */
    @Transactional(readOnly = true)
    public boolean hasPower(UUID callerId, UUID elderId, DelegatedPower power) {
        boolean linked = familyLinkRepository.findByElderIdAndFamilyUserId(elderId, callerId)
                .filter(l -> l.getStatus() == FamilyLinkStatus.ACTIVE)
                .isPresent();
        return linked && powerRepository.existsByElderIdAndFamilyUserIdAndPower(elderId, callerId, power);
    }

    /** The gate every delegated action calls. Throws 403 if the caller may not act. */
    @Transactional(readOnly = true)
    public void assertDelegated(UUID callerId, UUID elderId, DelegatedPower power) {
        if (!hasPower(callerId, elderId, power)) {
            throw new ForbiddenException("You don't have permission to do this for them");
        }
    }

    /**
     * True if this friendship is one the parent has chosen to share with family
     * ("Watching"). A friendship they kept to themselves is invisible to family,
     * and — see {@link #hasPowerOn} — untouchable by them too.
     */
    public boolean isWatched(Connection connection) {
        return connection != null && Boolean.TRUE.equals(connection.getSharedWithFamily());
    }

    /**
     * The gate for a power exercised on ONE friendship: the grant must hold AND the
     * parent must be sharing that friendship.
     *
     * Watching has to gate doing, not only seeing. Without this, granting a power
     * once would let a family member act on every friendship the parent has —
     * including the ones they deliberately kept private. The UI would hide those
     * friendships while the server quietly accepted a direct request for them, so
     * "they only see the friendships you choose to share" would be true of seeing
     * and false of doing. A power is only ever as wide as what the parent shared.
     *
     * Not every power is per-friendship: MANAGE_HELP_REQUESTS acts on the parent's
     * own help requests, which belong to no friendship, so it keeps using
     * {@link #hasPower}.
     */
    @Transactional(readOnly = true)
    public boolean hasPowerOn(UUID callerId, UUID elderId, DelegatedPower power, Connection connection) {
        return isWatched(connection) && hasPower(callerId, elderId, power);
    }

    /** {@link #hasPowerOn} as a gate. Throws 403, naming whichever half is missing. */
    @Transactional(readOnly = true)
    public void assertDelegatedOn(UUID callerId, UUID elderId, DelegatedPower power, Connection connection) {
        if (!isWatched(connection)) {
            throw new ForbiddenException("They haven't shared this friendship with their family");
        }
        assertDelegated(callerId, elderId, power);
    }

    /** The elders who have delegated the given power to this family member. */
    @Transactional(readOnly = true)
    public List<UUID> eldersDelegatingTo(UUID familyUserId, DelegatedPower power) {
        return familyLinkRepository.findByFamilyUserIdAndStatus(familyUserId, FamilyLinkStatus.ACTIVE).stream()
                .map(l -> l.getElder().getId())
                .filter(elderId -> powerRepository.existsByElderIdAndFamilyUserIdAndPower(elderId, familyUserId, power))
                .toList();
    }

    /**
     * Consent flow (2026-07-26): the family side of an ACTIVE link asks for one
     * power. Asking never grants — it only puts a card in front of the elder.
     * One open ask per power, and any answered ask starts a cooldown before the
     * same power can be asked for again.
     */
    @Transactional
    public FamilyPowerRequest requestPower(UUID callerId, UUID linkId, DelegatedPower power) {
        FamilyLink link = familyLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Family link not found"));
        if (!link.getFamilyUser().getId().equals(callerId)) {
            throw new ForbiddenException("Only the family member can ask for this");
        }
        if (link.getStatus() != FamilyLinkStatus.ACTIVE) {
            throw new IllegalStateException("This family link isn't active any more");
        }
        UUID elderId = link.getElder().getId();
        if (powerRepository.existsByElderIdAndFamilyUserIdAndPower(elderId, callerId, power)) {
            throw new IllegalArgumentException("They already let you do this");
        }
        if (requestRepository.findByElderIdAndFamilyUserIdAndPowerAndStatus(
                elderId, callerId, power, PowerRequestStatus.PENDING).isPresent()) {
            throw new IllegalArgumentException("You've already asked — they haven't decided yet");
        }
        boolean coolingDown = requestRepository
                .findTopByElderIdAndFamilyUserIdAndPowerAndStatusInOrderByRespondedAtDesc(
                        elderId, callerId, power,
                        List.of(PowerRequestStatus.APPROVED, PowerRequestStatus.DECLINED))
                .map(r -> r.getRespondedAt() != null
                        && r.getRespondedAt().isAfter(LocalDateTime.now().minusDays(REQUEST_COOLDOWN_DAYS)))
                .orElse(false);
        if (coolingDown) {
            throw new IllegalArgumentException("You asked about this recently — you can ask again in a few days");
        }
        return requestRepository.save(FamilyPowerRequest.builder()
                .elder(link.getElder())
                .familyUser(link.getFamilyUser())
                .power(power)
                .build());
    }

    /**
     * The elder answers an ask. The link is re-checked ACTIVE inside this
     * transaction so an unlink racing an approve can never leave a grant behind
     * for a pair that is no longer family.
     */
    @Transactional
    public void respondToRequest(UUID callerId, UUID requestId, boolean accept) {
        FamilyPowerRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (!request.getElder().getId().equals(callerId)) {
            throw new ForbiddenException("Only the parent can answer this");
        }
        if (request.getStatus() != PowerRequestStatus.PENDING) {
            throw new IllegalStateException("This request has already been answered");
        }
        boolean linked = familyLinkRepository
                .findByElderIdAndFamilyUserId(request.getElder().getId(), request.getFamilyUser().getId())
                .filter(l -> l.getStatus() == FamilyLinkStatus.ACTIVE)
                .isPresent();
        if (!linked) {
            throw new IllegalStateException("This person is no longer linked to you");
        }
        request.setStatus(accept ? PowerRequestStatus.APPROVED : PowerRequestStatus.DECLINED);
        request.setRespondedAt(LocalDateTime.now());
        requestRepository.save(request);
        if (accept && !powerRepository.existsByElderIdAndFamilyUserIdAndPower(
                request.getElder().getId(), request.getFamilyUser().getId(), request.getPower())) {
            powerRepository.save(FamilyDelegatedPower.builder()
                    .elder(request.getElder())
                    .familyUser(request.getFamilyUser())
                    .power(request.getPower())
                    .build());
        }
    }

    /** The open asks for one pair — rides on the links payload for both seats. */
    @Transactional(readOnly = true)
    public List<FamilyPowerRequest> pendingRequests(UUID elderId, UUID familyUserId) {
        return requestRepository.findByElderIdAndFamilyUserIdAndStatus(
                elderId, familyUserId, PowerRequestStatus.PENDING);
    }

    /**
     * Unlinking ends consent: every grant and every open ask for the pair goes.
     * Without this, revoke → re-link → accept silently resurrected every old
     * power with no new consent from the elder.
     */
    @Transactional
    public void revokeAll(UUID elderId, UUID familyUserId) {
        powerRepository.deleteByElderIdAndFamilyUserId(elderId, familyUserId);
        requestRepository.deleteByElderIdAndFamilyUserIdAndStatus(elderId, familyUserId, PowerRequestStatus.PENDING);
    }
}
