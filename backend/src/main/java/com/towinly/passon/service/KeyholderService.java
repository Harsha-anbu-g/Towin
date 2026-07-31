package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.dto.KeyholderAskResponse;
import com.towinly.passon.dto.KeyholderResponse;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnOpen;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The people an elder asks to hold a key to her Sealed box: asking them, their own answer,
 * and every way the arrangement can end.
 *
 * <h2>Nobody is conscripted</h2>
 * A row starts INVITED and only the invited person moves it to ACTIVE, on their own screen,
 * with the words in front of them. Being somebody's daughter is not consent to a duty about
 * their death, and the elder cannot answer on their behalf. Anyone who said yes can step
 * back out again whenever they like, and the card says so.
 *
 * <h2>Membership is re-derived, never snapshotted</h2>
 * Holding a key means ACTIVE <em>and</em> still on the elder's family list, worked out on the
 * spot on every read, in the {@code FamilyStandingService} style. This is not tidiness: the
 * number of Keyholders who must agree is the entire lock, and a stored count would keep
 * counting somebody who unlinked their account last night.
 *
 * <h2>The asymmetry, which is not an oversight</h2>
 * Asking somebody new tells every family member and restarts the elder's seven days.
 * <b>Taking a key back tells nobody and takes effect at once.</b> An elder who has realised
 * one relative is leaning on her must be able to take that person's key away without the app
 * telling them she did it, and without leaving it working for another week. Anyone who
 * "fixes" this by making removal symmetrical has removed her only quiet exit.
 *
 * <h2>Two remove buttons would be a trap</h2>
 * Unlinking somebody from the family list ends their key too — {@link #onFamilyLinkEnded},
 * called from {@code FamilyService.revoke}. An elder should never have to understand that
 * "remove from my family" and "take back their key" are different buttons with different
 * consequences.
 */
@Service
@RequiredArgsConstructor
public class KeyholderService {

    /** The elder's own week to change her mind, restarted whenever she widens the circle. */
    static final int COOLING_OFF_DAYS = 7;

    /**
     * At most five, matching the family list itself. Keyholders are drawn from family links,
     * so this can only ever bind if that cap moves.
     */
    static final int MAX_KEYHOLDERS = 5;

    static final String FAMILY_ONLY =
            "You can only ask someone who is already on your family list.";
    static final String ALREADY_ASKED = "You have already asked that person.";
    static final String ALREADY_ANSWERED = "That has already been answered.";
    /** Covers every terminal status at once, without naming which one it was. */
    static final String NO_LONGER_HOLDING = "That person is not holding a key any more.";
    static final String TOO_MANY =
            "You can ask up to " + MAX_KEYHOLDERS + " people to hold a key.";
    static final String NOT_YOURS = "That was not asked of you.";
    static final String NOT_HOLDING = "You are not holding a key for that person.";
    /** Lowercase "not found" is what GlobalExceptionHandler turns into a 404. */
    static final String NOT_FOUND = "That was not found";
    private static final String USER_NOT_FOUND = "User not found";

    /** actor_label is VARCHAR(60): a very long name must not turn an audit row into an error. */
    private static final int ACTOR_LABEL_MAX = 60;

    private final KeyholderRepository keyholders;
    private final FamilyLinkRepository familyLinks;
    private final PassOnSettingsRepository settings;
    private final PassOnOpenRepository opens;
    private final UserRepository users;
    private final ElderProfileRepository elderProfiles;
    private final HelperProfileRepository helperProfiles;
    private final PassOnAlertService alerts;
    private final Clock clock;

    // ── reading ──

    /**
     * "Who can open it one day", as the elder sees it: everybody she has ever asked, in the
     * order she asked them, each marked with whether they count toward the number right now.
     */
    @Transactional(readOnly = true)
    public List<KeyholderResponse> mine(UUID ownerId) {
        Set<UUID> onTheFamilyList = familyListOf(ownerId);
        return keyholders.findByOwnerIdOrderByInvitedAtAsc(ownerId).stream()
                .map(row -> toResponse(row, onTheFamilyList))
                .toList();
    }

    /**
     * The cards waiting on one person's own screen. Only INVITED rows: somebody who has
     * already answered is not being asked anything.
     */
    @Transactional(readOnly = true)
    public List<KeyholderAskResponse> askedOfMe(UUID personId) {
        return keyholders.findByKeyholderIdAndStatus(personId, KeyholderStatus.INVITED).stream()
                .map(this::toAsk)
                .toList();
    }

    /**
     * How many people actually hold a key today. Derived from two live facts and stored
     * nowhere — this number is the lock, so it is never allowed to be stale.
     */
    @Transactional(readOnly = true)
    public long activeCount(UUID ownerId) {
        Set<UUID> onTheFamilyList = familyListOf(ownerId);
        return keyholders.findByOwnerIdAndStatus(ownerId, KeyholderStatus.ACTIVE).stream()
                .filter(row -> onTheFamilyList.contains(row.getKeyholder().getId()))
                .count();
    }

    // ── the elder's side ──

    /**
     * Asks one person. Loud: the whole family are told, and her own seven days start again.
     *
     * A row for somebody who said no, resigned, or came off the family list is reset and
     * reused rather than replaced, because {@code UNIQUE(owner_id, keyholder_id)} allows only
     * one row per pair — the same trick {@code FamilyService.createRequest} uses.
     */
    @Transactional
    public KeyholderResponse invite(UUID ownerId, UUID personId) {
        User owner = getUser(ownerId);
        User person = getUser(personId);
        requireOnFamilyList(ownerId, personId);

        Optional<Keyholder> existing = keyholders.findByOwnerIdAndKeyholderId(ownerId, personId);
        existing.ifPresent(row -> {
            if (row.getStatus() == KeyholderStatus.INVITED || row.getStatus() == KeyholderStatus.ACTIVE) {
                throw new IllegalArgumentException(ALREADY_ASKED);
            }
        });
        requireRoomForOneMore(ownerId, existing.orElse(null));

        Keyholder row = existing.orElseGet(() -> Keyholder.builder()
                .owner(owner)
                .keyholder(person)
                .invitedAt(LocalDateTime.now(clock))
                .build());
        row.setStatus(KeyholderStatus.INVITED);
        row.setRespondedAt(null);
        Keyholder saved = keyholders.save(row);

        alerts.keyholderAsked(owner, nameOf(person));
        restartTheSevenDays(ownerId);
        return toResponse(saved, familyListOf(ownerId));
    }

    /**
     * Asks everybody she picked, at the end of setup and not as she taps them.
     *
     * Nothing is asked of anybody until she finishes: backing out halfway through the setup
     * must leave three people who were never asked a question about her death. The card she
     * is shown afterwards says "we have written to Sarah, David and Ruth", and that sentence
     * becomes true here, at the moment it appears.
     *
     * <p>Anybody already standing — asked and not yet answered, or holding a key — is
     * skipped, so she can come back and change the number who must agree without asking the
     * same people a second time.
     */
    @Transactional
    public void inviteAll(UUID ownerId, List<UUID> personIds) {
        for (UUID personId : personIds) {
            if (alreadyStanding(ownerId, personId)) continue;
            invite(ownerId, personId);
        }
    }

    /**
     * Takes one person's key back. Quiet, and immediate.
     *
     * No alert and no restarted week, both deliberately. See the class note — this is the
     * elder's only silent way out of an arrangement somebody talked her into.
     */
    @Transactional
    public void remove(UUID ownerId, UUID keyholderRowId) {
        Keyholder row = keyholders.findByIdAndOwnerId(keyholderRowId, ownerId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND));
        if (isOver(row.getStatus())) throw new IllegalArgumentException(NO_LONGER_HOLDING);

        row.setStatus(KeyholderStatus.REMOVED);
        row.setRespondedAt(LocalDateTime.now(clock));
        keyholders.save(row);
    }

    // ── the other person's side ──

    /** Yes or no, from the only person entitled to say either. */
    @Transactional
    public void respond(UUID personId, UUID keyholderRowId, boolean accept) {
        Keyholder row = keyholders.findById(keyholderRowId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND));
        if (!row.getKeyholder().getId().equals(personId)) {
            throw new IllegalArgumentException(NOT_YOURS);
        }
        if (row.getStatus() != KeyholderStatus.INVITED) {
            throw new IllegalArgumentException(ALREADY_ANSWERED);
        }

        row.setStatus(accept ? KeyholderStatus.ACTIVE : KeyholderStatus.DECLINED);
        row.setRespondedAt(LocalDateTime.now(clock));
        keyholders.save(row);

        // A "yes" goes into the elder's own record; a "no" shows on her list as a plain
        // status with the date on it, and does not need a second line saying the same thing.
        if (accept) {
            writeItDown(row, PassOnOpenKind.KEYHOLDER_ACCEPTED,
                    nameOf(row.getKeyholder()) + " agreed to hold a key.");
        }
    }

    /** Stepping back out. "You can change your mind whenever you like" has to be true. */
    @Transactional
    public void resign(UUID personId, UUID keyholderRowId) {
        Keyholder row = keyholders.findById(keyholderRowId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND));
        if (!row.getKeyholder().getId().equals(personId)) {
            throw new IllegalArgumentException(NOT_YOURS);
        }
        if (row.getStatus() != KeyholderStatus.ACTIVE) {
            throw new IllegalArgumentException(NOT_HOLDING);
        }

        row.setStatus(KeyholderStatus.RESIGNED);
        row.setRespondedAt(LocalDateTime.now(clock));
        keyholders.save(row);

        writeItDown(row, PassOnOpenKind.KEYHOLDER_RESIGNED,
                nameOf(row.getKeyholder()) + " is no longer holding a key.");
    }

    /**
     * Takes every key back at once, when the elder undoes the whole setup.
     *
     * Reaches the person who has not answered yet as well as the person who said yes: an
     * undo that left an INVITED row behind would leave a question about her mother's death
     * sitting on a daughter's screen after the mother took it back.
     *
     * <p>As quiet as {@link #remove}, and for the same reason — the tap that reaches this is
     * the one labelled "If this was not your idea, undo it", so the person whose idea it was
     * is exactly who must not be told.
     */
    @Transactional
    public void removeAll(UUID ownerId) {
        LocalDateTime now = LocalDateTime.now(clock);
        for (Keyholder row : keyholders.findByOwnerIdOrderByInvitedAtAsc(ownerId)) {
            // A daughter who resigned in June did not have her key taken off her in August.
            if (isOver(row.getStatus())) continue;
            row.setStatus(KeyholderStatus.REMOVED);
            row.setRespondedAt(now);
            keyholders.save(row);
        }
    }

    // ── the family link ending takes the key with it ──

    /**
     * Called from {@code FamilyService.revoke} whenever a family link ends, from either
     * side. The key ends with the link, and the elder is told on her own record — she may
     * not have been the one who ended it.
     *
     * Silent when there is nothing to end: most revoked links have no Keyholder row at all,
     * and a row that already finished is not re-finished with a later date.
     */
    @Transactional
    public void onFamilyLinkEnded(UUID elderId, UUID familyUserId) {
        Optional<Keyholder> found = keyholders.findByOwnerIdAndKeyholderId(elderId, familyUserId);
        if (found.isEmpty()) return;

        Keyholder row = found.get();
        if (isOver(row.getStatus())) return;

        row.setStatus(KeyholderStatus.ENDED);
        row.setRespondedAt(LocalDateTime.now(clock));
        keyholders.save(row);

        writeItDown(row, PassOnOpenKind.KEYHOLDER_ENDED,
                nameOf(row.getKeyholder()) + " came off your family list, so they are no longer "
                        + "holding a key.");
    }

    // ── the rules ──

    /**
     * Keyholders come from the family list and nowhere else — no outside friend, no notary,
     * no helper. This also happens to be the whole reason there is no separate "elders only"
     * check on {@link #invite}: the lookup is by <em>elder</em> id, so anybody who is not
     * sitting in an elder seat finds no link and is refused here, structurally.
     */
    private void requireOnFamilyList(UUID ownerId, UUID personId) {
        boolean linked = familyLinks.findByElderIdAndFamilyUserId(ownerId, personId)
                .map(FamilyLink::getStatus)
                .filter(status -> status == FamilyLinkStatus.ACTIVE)
                .isPresent();
        if (!linked) throw new IllegalArgumentException(FAMILY_ONLY);
    }

    /** Asked and waiting, or holding a key. Either way, not somebody to ask again. */
    private boolean alreadyStanding(UUID ownerId, UUID personId) {
        return keyholders.findByOwnerIdAndKeyholderId(ownerId, personId)
                .map(row -> !isOver(row.getStatus()))
                .orElse(false);
    }

    private void requireRoomForOneMore(UUID ownerId, Keyholder reusing) {
        long standing = keyholders.findByOwnerIdOrderByInvitedAtAsc(ownerId).stream()
                .filter(row -> !isOver(row.getStatus()))
                .filter(row -> reusing == null || !row.getId().equals(reusing.getId()))
                .count();
        if (standing >= MAX_KEYHOLDERS) throw new IllegalArgumentException(TOO_MANY);
    }

    /**
     * Widening the circle restarts the elder's week. Nothing to restart before she has set
     * the box up — the week is counted from arming, and there is no row until then.
     */
    private void restartTheSevenDays(UUID ownerId) {
        settings.findById(ownerId).ifPresent(row -> {
            row.setCoolingOffUntil(LocalDateTime.now(clock).plusDays(COOLING_OFF_DAYS));
            settings.save(row);
        });
    }

    /** Every status a row never comes back from on its own. */
    private static boolean isOver(KeyholderStatus status) {
        return status != KeyholderStatus.INVITED && status != KeyholderStatus.ACTIVE;
    }

    // ── plumbing ──

    /** Who is on the elder's family list right now, asked fresh every time. */
    private Set<UUID> familyListOf(UUID ownerId) {
        return familyLinks.findByElderIdAndStatus(ownerId, FamilyLinkStatus.ACTIVE).stream()
                .map(link -> link.getFamilyUser().getId())
                .collect(Collectors.toSet());
    }

    private KeyholderResponse toResponse(Keyholder row, Set<UUID> onTheFamilyList) {
        User person = row.getKeyholder();
        boolean counts = row.getStatus() == KeyholderStatus.ACTIVE
                && onTheFamilyList.contains(person.getId());
        return new KeyholderResponse(row.getId(), person.getId(), nameOf(person),
                row.getStatus(), counts, row.getInvitedAt(), row.getRespondedAt());
    }

    private KeyholderAskResponse toAsk(Keyholder row) {
        User owner = row.getOwner();
        int asked = (int) keyholders.findByOwnerIdOrderByInvitedAtAsc(owner.getId()).stream()
                .filter(other -> !isOver(other.getStatus()))
                .count();
        Short approvals = settings.findById(owner.getId())
                .map(PassOnSettings::getApprovalsNeeded)
                .orElse(null);
        return new KeyholderAskResponse(row.getId(), owner.getId(), nameOf(owner), approvals, asked);
    }

    private void writeItDown(Keyholder row, PassOnOpenKind kind, String note) {
        opens.save(PassOnOpen.builder()
                .ownerId(row.getOwner().getId())
                .kind(kind)
                .at(LocalDateTime.now(clock))
                .actorLabel(actorLabel(row.getKeyholder()))
                .note(note)
                .build());
    }

    /** A name as it stood at the time, never a user id, and never longer than the column. */
    private String actorLabel(User user) {
        String name = nameOf(user);
        return name.length() <= ACTOR_LABEL_MAX ? name : name.substring(0, ACTOR_LABEL_MAX);
    }

    private String nameOf(User user) {
        return DisplayNameResolver.resolve(elderProfiles, helperProfiles, user);
    }

    private User getUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException(USER_NOT_FOUND));
    }
}
