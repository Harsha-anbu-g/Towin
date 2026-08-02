package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.passon.dto.PassOnFromResponse;
import com.towinly.passon.dto.PassOnItemRequest;
import com.towinly.passon.dto.PassOnItemResponse;
import com.towinly.passon.dto.PassOnMineResponse;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * The Story box and the Letters: writing them, editing them, taking them down, and handing one
 * elder's writing to one visitor.
 *
 * Three rules are load-bearing and all three live here rather than in a screen.
 *
 * The first is that a letter may be held until after she is gone ({@link PassOnRelease#AFTER})
 * and a story never may. A story is something she shares while she is here; only a letter, to
 * one named person, can be left behind. Postgres says the same in {@code ck_passon_story}, and
 * this is where it becomes a sentence she can read.
 *
 * The second is that a letter already passed on is hers no longer — see
 * {@link #requireNotAlreadyPassedOn}. Everything else she wrote stays hers to change forever.
 *
 * The third is that nothing here decides who may read anything. Every visitor's item passes
 * through {@link PassOnVisibilityService}, which re-derives the answer on the spot, so a family
 * link revoked this morning stops granting a read on the very next call — and a letter held
 * until after she is gone stays shut until a person, not this code, releases it.
 */
@Service
@RequiredArgsConstructor
public class PassOnService {

    /** Exactly the sentence an elder reads, so a client never has to invent one. */
    static final String STORY_IS_FOR_TODAY =
            "A story is for people to read now. Only a letter can be kept until after you are gone.";
    static final String ALREADY_PASSED_ON =
            "This letter has already been passed on to the person it was for. It cannot be changed "
                    + "or taken down now.";
    static final String LETTER_IS_FOR_ONE_PERSON = "A letter goes to one person, and only that person.";
    static final String PICK_THE_PERSON = "Please choose the one person this is for.";
    static final String ELDERS_ONLY = "Only elders can write on this page.";
    static final String NOT_FOUND = "That writing was not found";
    static final String NO_SUCH_PERSON = "We couldn't find that person";

    private final PassOnItemRepository items;
    private final UserRepository users;
    private final ElderProfileRepository elderProfiles;
    private final HelperProfileRepository helperProfiles;
    private final PassOnVisibilityService visibility;
    /** Whether a person has released this owner's things. Nothing here ever sets it. */
    private final ReleaseGate releases;

    /** Her own page: one list per tab, everything she wrote, in the order she wrote it. */
    @Transactional(readOnly = true)
    public PassOnMineResponse mine(UUID ownerId) {
        return PassOnMineResponse.builder()
                .stories(toResponses(items.findByOwnerIdAndKindOrderByCreatedAtDesc(ownerId, PassOnKind.STORY)))
                .letters(toResponses(items.findByOwnerIdAndKindOrderByCreatedAtDesc(ownerId, PassOnKind.LETTER)))
                .build();
    }

    @Transactional
    public PassOnItemResponse create(UUID ownerId, PassOnItemRequest request) {
        User owner = getUser(ownerId);
        requireElderSeat(owner);
        checkRules(request.getKind(), request);

        PassOnItem item = PassOnItem.builder()
                .owner(owner)
                .kind(request.getKind())
                .title(request.getTitle().trim())
                .body(request.getBody().trim())
                .photoUrl(blankToNull(request.getPhotoUrl()))
                .audience(request.getAudience())
                .audienceUser(namedPerson(request))
                .releaseWhen(releaseOf(request))
                .build();
        return toResponse(items.save(item));
    }

    /**
     * Edits the words, the photo and who may see them. {@code kind} is read from the row and
     * not from the request — a story never becomes a letter, and the rules are checked against
     * what this actually is.
     */
    @Transactional
    public PassOnItemResponse update(UUID ownerId, UUID itemId, PassOnItemRequest request) {
        PassOnItem item = getOwnItem(ownerId, itemId);
        requireNotAlreadyPassedOn(item);
        checkRules(item.getKind(), request);

        item.setTitle(request.getTitle().trim());
        item.setBody(request.getBody().trim());
        item.setPhotoUrl(blankToNull(request.getPhotoUrl()));
        item.setAudience(request.getAudience());
        item.setAudienceUser(namedPerson(request));
        // She may change her mind about the timing as freely as about the words: a letter she
        // meant to leave behind becomes one to hand over today with a single tap, and back again.
        item.setReleaseWhen(releaseOf(request));
        return toResponse(items.save(item));
    }

    @Transactional
    public void delete(UUID ownerId, UUID itemId) {
        PassOnItem item = getOwnItem(ownerId, itemId);
        requireNotAlreadyPassedOn(item);
        items.delete(item);
    }

    /**
     * "From Margaret" — what this one visitor may read. The list is filtered item by item by
     * {@link PassOnVisibilityService} and by nothing else: a finder that returned "what this
     * person may read" would become a second authority on visibility, and there can only be one.
     */
    @Transactional
    public PassOnFromResponse from(UUID viewerId, UUID ownerId) {
        User owner = users.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("This page was not found"));

        List<PassOnItemResponse> readable = new ArrayList<>();
        for (PassOnItem item : items.findByOwnerIdOrderByCreatedAtDesc(ownerId)) {
            if (!visibility.canRead(item, viewerId)) continue;
            stampIfFirstRead(item, viewerId);
            readable.add(toResponse(item));
        }

        return PassOnFromResponse.builder()
                .ownerId(ownerId)
                .ownerName(nameOf(owner))
                .items(readable)
                .build();
    }

    /**
     * "Sarah read this on 3 June", written down once and never again. Only the person the
     * letter names sets it — the writer re-reading her own page is not a delivery, and a
     * second visit must not move the date the family were shown.
     */
    private void stampIfFirstRead(PassOnItem item, UUID viewerId) {
        if (item.getKind() != PassOnKind.LETTER) return;
        if (item.getFirstReadAt() != null) return;
        if (item.getOwner().getId().equals(viewerId)) return;
        User named = item.getAudienceUser();
        if (named == null || !named.getId().equals(viewerId)) return;

        item.setFirstReadAt(LocalDateTime.now());
        items.save(item);
    }

    // ── the rules ──

    private void checkRules(PassOnKind kind, PassOnItemRequest request) {
        // Letters may be held back; stories never are. Postgres says the same thing in
        // ck_passon_story, but a constraint violation reaches her as a 500 and a shrug.
        if (kind == PassOnKind.STORY && request.getReleaseWhen() == PassOnRelease.AFTER) {
            throw new IllegalArgumentException(STORY_IS_FOR_TODAY);
        }
        if (kind == PassOnKind.LETTER && request.getAudience() != PassOnAudience.PERSON) {
            throw new IllegalArgumentException(LETTER_IS_FOR_ONE_PERSON);
        }
        if (request.getAudience() == PassOnAudience.PERSON && request.getAudienceUserId() == null) {
            throw new IllegalArgumentException(PICK_THE_PERSON);
        }
    }

    /**
     * The named person, and only when the elder chose "one person". A name left over from a
     * choice she changed her mind about would break the database's own {@code ck_passon_person}
     * rule, so it is dropped here rather than carried and rejected later.
     */
    /**
     * Nothing she wrote is ever locked to her — with one exception, and this is it.
     *
     * <p>A letter held until after she is gone stops being hers to change the moment a person
     * releases it, because by then the daughter it was addressed to has very likely read it.
     * Editing it afterwards would rewrite what a bereaved person was told, and deleting it would
     * take back words she has already been given. Everything else on the page stays editable
     * forever; a letter she chose to be read today was never gated on the release and is not
     * gated on it now.
     *
     * <p>In practice the owner is dead by the time this can refuse anything. It is enforced
     * anyway, on the server, because "she cannot log in" is a circumstance and not a rule.
     */
    private void requireNotAlreadyPassedOn(PassOnItem item) {
        if (item.getReleaseWhen() == PassOnRelease.NOW) return;
        if (!releases.isReleased(item.getOwner().getId())) return;
        throw new IllegalArgumentException(ALREADY_PASSED_ON);
    }

    /** Left out means "they can read it now", which is what almost every elder means. */
    private static PassOnRelease releaseOf(PassOnItemRequest request) {
        return request.getReleaseWhen() == null ? PassOnRelease.NOW : request.getReleaseWhen();
    }

    private User namedPerson(PassOnItemRequest request) {
        if (request.getAudience() != PassOnAudience.PERSON || request.getAudienceUserId() == null) {
            return null;
        }
        return users.findById(request.getAudienceUserId())
                .orElseThrow(() -> new IllegalArgumentException(NO_SUCH_PERSON));
    }

    /**
     * The page is the elder's own. Helpers and family members have no Story box of their own in
     * this version, and the screen guard alone is not enforcement.
     */
    private void requireElderSeat(User user) {
        if (user.getRole() != UserRole.ELDER && user.getRole() != UserRole.BOTH) {
            throw new IllegalArgumentException(ELDERS_ONLY);
        }
    }

    // ── plumbing ──

    private PassOnItem getOwnItem(UUID ownerId, UUID itemId) {
        // Ownership is part of the query, so somebody else's id is a plain not-found and
        // never a read. "not found" (lowercase) is mapped to a 404 by GlobalExceptionHandler.
        return items.findByIdAndOwnerId(itemId, ownerId)
                .orElseThrow(() -> new IllegalArgumentException(NOT_FOUND));
    }

    private User getUser(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private String nameOf(User user) {
        return DisplayNameResolver.resolve(elderProfiles, helperProfiles, user);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private List<PassOnItemResponse> toResponses(List<PassOnItem> found) {
        return found.stream().map(this::toResponse).toList();
    }

    private PassOnItemResponse toResponse(PassOnItem item) {
        User named = item.getAudienceUser();
        return PassOnItemResponse.builder()
                .id(item.getId())
                .kind(item.getKind())
                .title(item.getTitle())
                .body(item.getBody())
                .photoUrl(item.getPhotoUrl())
                .audience(item.getAudience())
                .audienceUserId(named == null ? null : named.getId())
                .audienceUserName(named == null ? null : nameOf(named))
                .releaseWhen(item.getReleaseWhen())
                .firstReadAt(item.getFirstReadAt())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .build();
    }
}
