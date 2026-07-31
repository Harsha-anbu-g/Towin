package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.DisplayNameResolver;
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

    /** The record says an item was opened. It never says, in words, which one. */
    private static final String OPENED_NOTE = "Opened by the owner after typing her password.";
    private static final String DELETED_NOTE = "Taken out of the box by the owner.";
    private static final String ARMED_NOTE = "The box was set up.";

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

    // ── writing ──

    /** Seals one item and saves it. Nothing readable reaches the row, including the name. */
    @Transactional
    public SealedItemSummary add(UUID ownerId, SealedItemRequest request) {
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
        User owner = getUser(ownerId);
        SealedItem item = sealedItems.findByIdAndOwnerId(itemId, ownerId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND));

        sealedItems.delete(item);
        // sealed_item_id is ON DELETE SET NULL, so this line is written without it: pointing
        // at a row that is being deleted in the same breath would only null itself.
        writeItDown(owner, null, PassOnOpenKind.DELETED, DELETED_NOTE);
    }

    /**
     * Sets the box up: how many Keyholders she is aiming for and how many of them must agree.
     *
     * Arming starts the cooling-off week. That week is the only real defence against somebody
     * sitting beside an elder and tapping through the whole thing in one visit, so it is
     * stamped here, at the moment of arming, and not when the last Keyholder says yes.
     *
     * The three rules about the numbers themselves — at least two must agree, three to five
     * Keyholders, never unanimity — live in Postgres (V53) rather than here, so no future
     * caller can route around them.
     *
     * <p>Task 12 adds the two acknowledgements and the verified-email gate on top of this.
     */
    @Transactional
    public void arm(UUID ownerId, int approvalsNeeded, int keyholderTarget) {
        // Availability first: a box armed while the key is missing is a promise we cannot
        // keep, and the elder would have no way of knowing.
        requireCryptoAvailable();

        User owner = getUser(ownerId);
        requireOwnPassword(owner);

        LocalDateTime now = LocalDateTime.now(clock);
        PassOnSettings existing = settings.findById(ownerId)
                .orElseGet(() -> PassOnSettings.builder().ownerId(ownerId).build());
        existing.setApprovalsNeeded((short) approvalsNeeded);
        existing.setKeyholderTarget((short) keyholderTarget);
        existing.setArmedAt(now);
        existing.setCoolingOffUntil(now.plusDays(COOLING_OFF_DAYS));
        settings.save(existing);

        writeItDown(owner, null, PassOnOpenKind.BOX_ARMED, ARMED_NOTE);
        // Loud on purpose. Nothing here can stop a relative sitting beside her and tapping
        // through the whole thing; what this does is make sure the rest of the family see it
        // happen. Taking a Keyholder's key back is the one change that stays quiet — see
        // KeyholderService.remove.
        alerts.settingsChanged(owner);
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

    private void requireOwnPassword(User owner) {
        if (owner.getPasswordHash() == null) {
            throw new IllegalArgumentException(NEEDS_A_PASSWORD);
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
