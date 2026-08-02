package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.passon.dto.PassOnArmRequest;
import com.towinly.passon.dto.PassOnSetupResponse;
import com.towinly.passon.dto.PassOnSheetResponse;
import com.towinly.passon.dto.SealedItemRequest;
import com.towinly.passon.dto.SealedItemSummary;
import com.towinly.passon.dto.SealedRevealResponse;
import com.towinly.passon.entity.PassOnOpen;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.exception.SealedBoxUnavailableException;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.security.SealedRevealRateLimiter;
import com.towinly.passon.service.SealedCryptoService.OpenContents;
import com.towinly.passon.service.SealedCryptoService.SealedContents;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * The Sealed box: what the elder puts in it, what it takes to get one thing back out, and
 * the week in which nothing comes out at all.
 *
 * <h2>Two gates, and why there are two</h2>
 * Reading one item back needs the account password re-typed. Being signed in is not enough:
 * an unlocked phone on a kitchen table is the ordinary case, not the exotic one, and what is
 * behind this password is a bank account number rather than a session.
 *
 * A password alone would not be enough either, because control of an elder's inbox is
 * control of her password — the adult child who set up her email can reset it in a minute.
 * So no reveal is allowed for seven days after any credential change. That week is what
 * turns a silent theft into one the real owner has a chance to notice: the "your password
 * was changed" mail lands immediately, and the box stays shut long enough for her to act on
 * it. It is the single most valuable rule in this file, and the one most likely to be
 * quietly removed by somebody who reads it as an inconvenience. It is not.
 *
 * <h2>The body is decrypted on exactly one path</h2>
 * {@link #list} and the account export that reuses it call
 * {@link SealedCryptoService#openLabel} — the contents are never turned back into readable
 * text to draw a card that says "Locked". Only {@link #reveal} produces a body, and only
 * behind both gates.
 *
 * <h2>Failing shut</h2>
 * Nothing is written while the crypto is unavailable. A row saved without a working key is a
 * row nobody can ever open, and this is the one feature where that is not recoverable.
 */
@Service
@RequiredArgsConstructor
public class SealedBoxService {

    /** Seven days: long enough for a password-change mail to be seen and acted on. */
    static final int FREEZE_DAYS = 7;

    /**
     * The freeze blocks the first week; the family are told about any reveal in the rest of
     * this month. Whoever holds an elder's mailbox can reset her password and simply wait
     * seven days, and a silent box after that is a silent theft.
     */
    static final int TELL_THE_FAMILY_DAYS = 30;

    /** The elder's own week to undo the whole thing, counted from the moment she armed it. */
    static final int COOLING_OFF_DAYS = 7;

    /** "12 August" — the way a date is said out loud, not 2026-08-12. */
    private static final DateTimeFormatter PLAIN_DATE =
            DateTimeFormatter.ofPattern("d MMMM", Locale.UK);

    static final String WRONG_PASSWORD = "That password was not right. Please try again.";

    /**
     * Google-only accounts have no password of their own, and the box is guarded by nothing
     * else. Refusing to arm one is what stops a box existing that has no gate in front of it.
     */
    static final String NEEDS_A_PASSWORD =
            "Your Sealed box is kept shut by your password, and this account signs in with Google. "
                    + "Please set a password first, then come back.";

    /** Lowercase "not found" is what GlobalExceptionHandler turns into a 404. */
    static final String NOT_FOUND = "That was not found";

    private static final String USER_NOT_FOUND = "User not found";

    /**
     * The two sentences she ticks at the end of setup, and the reason they live on the server
     * rather than in the screen's own copy file.
     *
     * What is stored against her name is a hash of the wording she was shown. For that record
     * to mean anything years later there must be exactly one copy of each sentence in the
     * product: the screen renders these, sends them back, and this class hashes what it
     * received after checking it is still what it publishes. A second copy in the frontend
     * would drift, and the drift would be invisible — the hash would go on being written, of
     * a sentence nobody could look up any more.
     */
    public static final String NOT_A_WILL_ACK = "I understand this is not a will.";

    public static final String KEY_TRUTH_ACK =
            "I understand that Towinly holds the key, so someone here could open my box — and "
                    + "that means I can never be shut out of it either. If I forget my password I "
                    + "reset it as usual.";

    static final String TICK_BOTH = "Please tick both boxes to finish.";

    /**
     * The sentence that came back is not the sentence this version publishes, so we do not
     * know what she was shown and there is nothing honest to write down. She cannot fix this
     * and is not asked to try.
     */
    static final String WORDING_CHANGED =
            "Something has changed on this page. Please load it again and try again.";

    /**
     * Every way this box is ever reached again goes through her mailbox: the password reset,
     * the warning that her password was changed, and the release procedure itself. Arming a
     * box we cannot write to creates a locked box with nobody at the other end of it, and a
     * later release feature would have to open against that pool.
     */
    static final String CONFIRM_EMAIL =
            "Please confirm your email address before you set this up. One day it is how we would "
                    + "reach you about your box, and we need to know it works.";

    static final String PICK_THREE_TO_FIVE =
            "Please pick at least three people, and no more than five.";

    static final String HOW_MANY_MUST_AGREE =
            "The number who must agree has to be at least two, and always fewer than the number of "
                    + "people you picked.";

    static final String NOT_SET_UP = "Your box is not set up yet.";

    static final String ALREADY_SETTLED =
            "The seven days have passed, so this is settled. You can still take anybody's key back "
                    + "whenever you like.";

    /** The record says an item was opened. It never says, in words, which one. */
    private static final String OPENED_NOTE = "Opened by the owner after typing her password.";
    private static final String DELETED_NOTE = "Taken out of the box by the owner.";
    private static final String ARMED_NOTE = "The box was set up.";
    private static final String UNDONE_NOTE =
            "The setup was undone, and nobody is holding a key any more.";

    /** actor_label is VARCHAR(60): a very long name must not turn an audit row into an error. */
    private static final int ACTOR_LABEL_MAX = 60;

    private final SealedItemRepository sealedItems;
    private final PassOnSettingsRepository settings;
    private final PassOnOpenRepository opens;
    private final UserRepository users;
    private final SealedCryptoService crypto;
    private final PasswordEncoder passwordEncoder;
    private final SealedRevealRateLimiter revealLimiter;
    private final PassOnAlertService alerts;
    /** Setup asks everybody at the end, and undoing takes every key back. */
    private final KeyholderService keyholders;
    /** Where a family writes when the day comes. Null until a deployment sets it. */
    private final ReleaseContact releaseContact;
    /** Whether a person has released this owner's things. Nothing here ever sets it. */
    private final ReleaseGate releases;
    private final Clock clock;

    // ── reading ──

    /**
     * What is in the box, by name only. This is the owner's own list, and it is exactly what
     * the account export emits — so it must never grow a body field.
     */
    @Transactional(readOnly = true)
    public List<SealedItemSummary> list(UUID ownerId) {
        return sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(ownerId).stream()
                .map(item -> new SealedItemSummary(
                        item.getId(),
                        crypto.openLabel(ownerId, item.getId(), contentsOf(item)),
                        item.getKindHint(),
                        item.getByteSize(),
                        item.getCreatedAt()))
                .toList();
    }

    /**
     * One item, opened, for its owner and nobody else.
     *
     * The order of the checks is the design. The lockout comes first, so guessing costs
     * something. The freeze comes before the password, because during a freeze there is
     * nothing to be gained by getting the password right and therefore nothing to be learned
     * by trying. The item is looked up last and by {@code (id, owner)} together, so somebody
     * else's id is a plain not-found rather than a read.
     */
    @Transactional
    public SealedRevealResponse reveal(UUID ownerId, UUID itemId, String password) {
        revealLimiter.checkNotLocked(ownerId);

        // Sits with the freeze rather than with the password, for the same reason: once a person
        // has released her there is nothing to be gained by getting the password right, so there
        // is nothing to be learned by trying. It is an extra gate and not a replacement — the
        // password check below is untouched.
        //
        // Why a correct password is no longer enough: after a release the owner is dead, so
        // whoever is typing it is somebody else. The procedure she agreed to — a certificate read
        // by a person, her own quorum of Keyholders each confirming, thirty days of trying to
        // reach her — is the mechanism that decides who sees inside this box. A password is a
        // second door around all of it, and one that leaves the Keyholders no record it was used.
        // That the contents already went to the right people does not make a disclosure to the
        // wrong one harmless.
        if (releases.isReleased(ownerId)) {
            throw new IllegalArgumentException(ReleaseGate.boxCannotBeOpened(releaseContact.email()));
        }

        User owner = getUser(ownerId);
        requireOwnPassword(owner);

        LocalDateTime frozenUntil = frozenUntil(owner);
        if (frozenUntil != null) {
            throw new IllegalArgumentException(frozenMessage(frozenUntil));
        }

        if (!passwordEncoder.matches(password, owner.getPasswordHash())) {
            revealLimiter.recordFailure(ownerId);
            throw new IllegalArgumentException(WRONG_PASSWORD);
        }
        revealLimiter.reset(ownerId);

        SealedItem item = sealedItems.findByIdAndOwnerId(itemId, ownerId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND));

        OpenContents opened = crypto.open(ownerId, item.getId(), contentsOf(item));
        writeItDown(owner, item.getId(), PassOnOpenKind.OPENED_BY_OWNER, OPENED_NOTE);
        if (soonAfterACredentialChange(owner)) {
            alerts.openedSoonAfterPasswordChange(owner);
        }

        return new SealedRevealResponse(item.getId(), item.getKindHint(), opened.label(), opened.body());
    }

    /**
     * When the freeze lifts, or null when there is no freeze. The screen asks this so the
     * elder is told why her box will not open <em>before</em> she types her password into it,
     * rather than after.
     */
    @Transactional(readOnly = true)
    public LocalDateTime revealFrozenUntil(UUID ownerId) {
        return frozenUntil(getUser(ownerId));
    }

    /**
     * Everything her saved one-page copy is built from: what is in the box by name, who can ask
     * to open it, and how many of them must agree.
     *
     * <h3>This is the payload that leaves the app</h3>
     * The sheet is downloaded as a file and kept in a drawer, so it is the one thing here that
     * outlives us. It is built on {@link #list}, which unwraps names through
     * {@code openLabel} and never produces a body — see the note at the top of this class. There
     * is no password gate on it for exactly that reason: nothing on this page is a secret, and
     * asking an elder for her password to be told the names of her own things would teach her to
     * type it whenever anything asks.
     *
     * <p>Answered before setup as well as after. She may look at this while she is deciding, and
     * a page that refuses until the box is armed would hide the thing she is being asked to
     * judge.
     */
    @Transactional(readOnly = true)
    public PassOnSheetResponse sheet(UUID ownerId) {
        User owner = getUser(ownerId);
        PassOnSettings row = settings.findById(ownerId).orElse(null);

        return new PassOnSheetResponse(
                DisplayNameResolver.fromUser(owner),
                LocalDateTime.now(clock),
                row != null && row.getArmedAt() != null,
                row == null ? null : row.getApprovalsNeeded(),
                row == null ? null : row.getKeyholderTarget(),
                list(ownerId),
                keyholders.mine(ownerId),
                row == null ? null : row.getSheetSavedAt(),
                releaseContact.email());
    }

    /**
     * She has taken a copy out of the app. Recorded so the page can stop saying "you have not
     * saved a copy yet", which is the only honest way to press the point that Towinly must not
     * be her only copy.
     *
     * <p>Before she has set the box up there is no settings row to write on — that row is
     * created by {@link #arm}, and it cannot exist earlier because the database requires a
     * quorum on it. The download still works; there is simply nowhere to note it, and failing
     * her download over a note would be the wrong way round.
     */
    @Transactional
    public void markSheetSaved(UUID ownerId) {
        settings.findById(ownerId).ifPresent(row -> {
            row.setSheetSavedAt(LocalDateTime.now(clock));
            settings.save(row);
        });
    }

    // ── writing ──

    /** Seals one item and saves it. Nothing readable reaches the row, including the name. */
    @Transactional
    public SealedItemSummary add(UUID ownerId, SealedItemRequest request) {
        requireNotReleased(ownerId);
        requireCryptoAvailable();
        User owner = getUser(ownerId);

        String label = request.getLabel().trim();
        // The id is decided here, not by the database: it is bound into the ciphertext as
        // additional authenticated data, which is what stops a blob being moved onto another
        // row. It cannot be left until after the insert.
        UUID itemId = UUID.randomUUID();
        SealedContents sealed = crypto.seal(ownerId, itemId, label, request.getBody().trim());

        SealedItem saved = sealedItems.save(SealedItem.builder()
                .id(itemId)
                .owner(owner)
                .labelCipher(sealed.labelCipher())
                .labelIv(sealed.labelIv())
                .kindHint(request.getKindHint())
                .bodyCipher(sealed.bodyCipher())
                .bodyIv(sealed.bodyIv())
                .wrappedKey(sealed.wrappedKey())
                .keyVersion(sealed.keyVersion())
                .byteSize(sealed.byteSize())
                .sortOrder(0)
                .build());

        writeItDown(owner, saved.getId(), PassOnOpenKind.CREATED, null);
        // The label is handed straight back from what she typed rather than decrypted again:
        // one fewer decrypt on the happy path, and the same string either way.
        return new SealedItemSummary(saved.getId(), label, saved.getKindHint(),
                sealed.byteSize(), saved.getCreatedAt());
    }

    /**
     * Takes one thing out. The row goes; the line saying a thing was taken out stays, because
     * an elder looking at her own record needs to see that something is missing on purpose.
     */
    @Transactional
    public void delete(UUID ownerId, UUID itemId) {
        requireNotReleased(ownerId);
        User owner = getUser(ownerId);
        SealedItem item = sealedItems.findByIdAndOwnerId(itemId, ownerId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND));

        sealedItems.delete(item);
        // sealed_item_id is ON DELETE SET NULL, so this line is written without it: pointing
        // at a row that is being deleted in the same breath would only null itself.
        writeItDown(owner, null, PassOnOpenKind.DELETED, DELETED_NOTE);
    }

    /**
     * Sets the box up: who she picked, how many of them must agree, and the two sentences she
     * ticked. This is the last step of setup and the only thing on it that writes.
     *
     * <h3>Everything happens here or nothing does</h3>
     * The invitations go out from inside this transaction rather than as she taps each person
     * in step one. Backing out halfway must leave three relatives who were never asked a
     * question about her death, and the card she is shown afterwards — "we have written to
     * Sarah, David and Ruth" — has to become true at the moment it appears.
     *
     * <h3>Arming starts the cooling-off week</h3>
     * That week is the only real defence against somebody sitting beside an elder and tapping
     * through the whole thing in one visit, so it is stamped at the moment of arming and not
     * when the last Keyholder says yes.
     *
     * <h3>Where the rules live</h3>
     * The three rules about the numbers — at least two must agree, three to five Keyholders,
     * never unanimity — are CHECK constraints in Postgres (V53) so no future caller can route
     * around them. They are also checked here, first, so that what she reads is a sentence in
     * her own words rather than a constraint violation.
     */
    @Transactional
    public void arm(UUID ownerId, PassOnArmRequest request) {
        requireNotReleased(ownerId);
        // Availability first: a box armed while the key is missing is a promise we cannot
        // keep, and the elder would have no way of knowing.
        requireCryptoAvailable();

        User owner = getUser(ownerId);
        requireOwnPassword(owner);
        requireConfirmedEmail(owner);

        // The same person picked twice is one person, and would otherwise inflate the pool
        // the quorum is measured against.
        List<UUID> people = request.getPersonIds() == null ? List.of()
                : request.getPersonIds().stream().distinct().toList();
        int approvalsNeeded = request.getApprovalsNeeded() == null ? 0 : request.getApprovalsNeeded();
        requireWorkableNumbers(people.size(), approvalsNeeded);

        // Checked before anything is written, so a mismatch asks nobody anything.
        String notAWillHash = hashOfExactly(request.getNotAWillAck(), NOT_A_WILL_ACK);
        String keyTruthHash = hashOfExactly(request.getKeyTruthAck(), KEY_TRUTH_ACK);

        keyholders.inviteAll(ownerId, people);

        LocalDateTime now = LocalDateTime.now(clock);
        PassOnSettings existing = settings.findById(ownerId)
                .orElseGet(() -> PassOnSettings.builder().ownerId(ownerId).build());
        existing.setApprovalsNeeded((short) approvalsNeeded);
        existing.setKeyholderTarget((short) people.size());
        existing.setArmedAt(now);
        existing.setCoolingOffUntil(now.plusDays(COOLING_OFF_DAYS));
        existing.setNotAWillAckAt(now);
        existing.setNotAWillAckHash(notAWillHash);
        existing.setKeyTruthAckAt(now);
        existing.setKeyTruthAckHash(keyTruthHash);
        settings.save(existing);

        writeItDown(owner, null, PassOnOpenKind.BOX_ARMED, ARMED_NOTE);
        // Loud on purpose. Nothing here can stop a relative sitting beside her and tapping
        // through the whole thing; what this does is make sure the rest of the family see it
        // happen. Taking a Keyholder's key back is the one change that stays quiet — see
        // KeyholderService.remove.
        alerts.settingsChanged(owner);
    }

    /**
     * Where she stands, for the setup screen — including the two refusals, so the last step
     * can say what is missing while she can still fix it rather than after she has picked
     * three people and ticked two boxes.
     */
    @Transactional(readOnly = true)
    public PassOnSetupResponse setup(UUID ownerId) {
        User owner = getUser(ownerId);
        PassOnSettings row = settings.findById(ownerId).orElse(null);

        boolean armed = row != null && row.getArmedAt() != null;
        return new PassOnSetupResponse(
                armed,
                row == null ? null : row.getArmedAt(),
                row == null ? null : row.getCoolingOffUntil(),
                armed && withinCoolingOff(row),
                row == null ? null : row.getApprovalsNeeded(),
                row == null ? null : row.getKeyholderTarget(),
                owner.isEmailVerified(),
                owner.getPasswordHash() != null,
                NOT_A_WILL_ACK,
                KEY_TRUTH_ACK,
                releaseContact.email());
    }

    /**
     * "If this was not your idea, undo it." Her rules go, and so does every key she just
     * handed out — leaving the keys behind would leave the relative who talked her into this
     * still holding one.
     *
     * <p>Nothing she wrote is touched. The undo is about the arrangement, never about her
     * writing, and no tap on a banner deletes what is in the box.
     *
     * <p>Silent, exactly like taking one person's key back. The tap that reaches this says
     * the setup was somebody else's idea, so that somebody is precisely who must not be told
     * she reversed it. Anyone who "fixes" the missing alert has removed her only quiet way
     * out. Her own record still shows it, because that record is hers alone.
     */
    @Transactional
    public void undoSetup(UUID ownerId) {
        requireNotReleased(ownerId);
        User owner = getUser(ownerId);
        PassOnSettings row = settings.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_SET_UP));
        if (row.getArmedAt() == null) throw new IllegalArgumentException(NOT_SET_UP);
        if (!withinCoolingOff(row)) throw new IllegalArgumentException(ALREADY_SETTLED);

        keyholders.removeAll(ownerId);
        // This row carries released_at, so this delete is the only thing in the codebase that can
        // un-release somebody. The guard at the top of this method is what stops it, and it is
        // load-bearing rather than defensive.
        //
        // An earlier version of this comment argued the guard was unnecessary, on the grounds
        // that the seven days are measured once from arming and a release takes a quorum plus
        // thirty days, so nobody could ever be both released and inside the window. That was
        // wrong. The window is not measured once: arm() rewrites coolingOffUntil to now + 7 with
        // no re-arm check, and KeyholderService.invite ends in restartTheSevenDays, which does
        // the same. Either one reopens this undo on demand — and re-arming with her existing
        // Keyholder ids asks nobody anything, because inviteAll skips people already standing.
        settings.deleteByOwnerId(ownerId);
        writeItDown(owner, null, PassOnOpenKind.SETTINGS_CHANGED, UNDONE_NOTE);
    }

    // ── the rules ──

    /**
     * The freeze. Null means the box may open; a date means it may not, and that date is what
     * the elder is shown.
     *
     * A null {@code credentialChangedAt} is every account that has never changed a password
     * since this column shipped, and it reads as "not frozen" — the honest answer, since the
     * column exists to date a change and there is no change to date.
     */
    private LocalDateTime frozenUntil(User owner) {
        LocalDateTime changedAt = owner.getCredentialChangedAt();
        if (changedAt == null) return null;

        LocalDateTime liftsAt = changedAt.plusDays(FREEZE_DAYS);
        return liftsAt.isAfter(LocalDateTime.now(clock)) ? liftsAt : null;
    }

    /**
     * Whether this reveal falls inside the month after a credential change. Days one to
     * seven never reach here — the freeze refuses them outright — so in practice this covers
     * days eight to thirty, which is exactly the window somebody who reset her password
     * would have to wait out.
     */
    private boolean soonAfterACredentialChange(User owner) {
        LocalDateTime changedAt = owner.getCredentialChangedAt();
        return changedAt != null
                && changedAt.plusDays(TELL_THE_FAMILY_DAYS).isAfter(LocalDateTime.now(clock));
    }

    /**
     * Word for word what the elder reads, with a real date in it. "If that was not you, tell
     * us straight away" is a promise the release procedure has to keep — see
     * {@code docs/operations/sealed-box-release.md}.
     */
    static String frozenMessage(LocalDateTime liftsAt) {
        return "You changed your password recently. For your safety your Sealed box stays shut until "
                + PLAIN_DATE.format(liftsAt)
                + ". If that was not you, tell us straight away.";
    }

    /**
     * Once a person has released this owner, the whole arrangement is settled: nothing goes into
     * the box, nothing comes out of it, and the setup can be neither redone nor undone.
     *
     * <h3>The two that carry real weight</h3>
     * {@link #undoSetup} deletes the settings row, and that row is the only thing carrying
     * {@code released_at} — so an ungated undo was an un-release, closing her letters again and
     * reopening her page to editing. {@link #arm} is how the undo was reached: it rewrites
     * {@code coolingOffUntil} to now + 7 with no re-arm check, and re-arming with her existing
     * Keyholder ids notifies nobody, because {@code inviteAll} skips people already standing.
     * {@code KeyholderService.invite} restarts the same week by a second route.
     *
     * <h3>The two that protect what is in the box</h3>
     * {@link #add} and {@link #delete} are gated so that whoever holds the account cannot empty
     * the box before the family open it, or plant something in it that reads as hers.
     *
     * <h3>What is deliberately left open</h3>
     * {@link #markSheetSaved} is not gated. Downloading the saved one-page copy is exactly what a
     * bereaved family legitimately does on this account, and all that write records is that they
     * did — it grants nothing and destroys nothing. Reads are not gated either; the release is
     * about what may still be changed, not about who may look.
     */
    private void requireNotReleased(UUID ownerId) {
        if (releases.isReleased(ownerId)) {
            throw new IllegalArgumentException(ReleaseGate.ALREADY_PASSED_ON);
        }
    }

    private void requireOwnPassword(User owner) {
        if (owner.getPasswordHash() == null) {
            throw new IllegalArgumentException(NEEDS_A_PASSWORD);
        }
    }

    /** No new box without a mailbox we know reaches her. See {@link #CONFIRM_EMAIL}. */
    private void requireConfirmedEmail(User owner) {
        if (!owner.isEmailVerified()) {
            throw new IllegalArgumentException(CONFIRM_EMAIL);
        }
    }

    /**
     * The same three rules Postgres enforces, said in her words first. A box one person can
     * open alone is not a lock; a box everybody must agree on is a permanent deadlock the
     * first time one Keyholder is unreachable or has died themselves.
     */
    private static void requireWorkableNumbers(int people, int approvalsNeeded) {
        if (people < 3 || people > KeyholderService.MAX_KEYHOLDERS) {
            throw new IllegalArgumentException(PICK_THREE_TO_FIVE);
        }
        if (approvalsNeeded < 2 || approvalsNeeded > people - 1) {
            throw new IllegalArgumentException(HOW_MANY_MUST_AGREE);
        }
    }

    /** Whether the one-tap undo is still open. Re-derived on every read, never stored. */
    private boolean withinCoolingOff(PassOnSettings row) {
        LocalDateTime until = row.getCoolingOffUntil();
        return until != null && until.isAfter(LocalDateTime.now(clock));
    }

    /**
     * The hash of the sentence she was shown — after checking it is still the sentence this
     * version publishes.
     *
     * The check is what makes the record mean something. Hashing whatever arrived would
     * faithfully store a sentence nobody could ever look up again; hashing our own constant
     * regardless of what arrived would record an agreement to words she may never have seen.
     */
    private static String hashOfExactly(String given, String published) {
        if (given == null || given.isBlank()) throw new IllegalArgumentException(TICK_BOTH);
        if (!given.equals(published)) throw new IllegalArgumentException(WORDING_CHANGED);
        return sha256Hex(published);
    }

    /** 64 hex characters, which is exactly what the CHAR(64) ack columns hold. */
    private static String sha256Hex(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                    .append(Character.forDigit(b & 0xF, 16));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required of every Java runtime. If it is genuinely absent the box
            // must not be armed, because the acknowledgement could not be recorded.
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private void requireCryptoAvailable() {
        if (!crypto.isAvailable()) {
            throw new SealedBoxUnavailableException(SealedBoxUnavailableException.MESSAGE);
        }
    }

    // ── plumbing ──

    private void writeItDown(User owner, UUID itemId, PassOnOpenKind kind, String note) {
        opens.save(PassOnOpen.builder()
                .ownerId(owner.getId())
                .sealedItemId(itemId)
                .kind(kind)
                .at(LocalDateTime.now(clock))
                .actorLabel(actorLabel(owner))
                .note(note)
                .build());
    }

    /** A name as it stood at the time, never a user id, and never longer than the column. */
    private static String actorLabel(User owner) {
        String name = DisplayNameResolver.fromUser(owner);
        return name.length() <= ACTOR_LABEL_MAX ? name : name.substring(0, ACTOR_LABEL_MAX);
    }

    private static SealedContents contentsOf(SealedItem item) {
        return new SealedContents(item.getLabelCipher(), item.getLabelIv(),
                item.getBodyCipher(), item.getBodyIv(), item.getWrappedKey(),
                item.getKeyVersion(), item.getByteSize());
    }

    private User getUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException(USER_NOT_FOUND));
    }
}
