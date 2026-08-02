package com.towinly.passon.controller;

import com.towinly.passon.dto.KeyholderAskResponse;
import com.towinly.passon.dto.KeyholderInviteRequest;
import com.towinly.passon.dto.KeyholderRespondRequest;
import com.towinly.passon.dto.KeyholderResponse;
import com.towinly.passon.dto.PassOnArmRequest;
import com.towinly.passon.dto.PassOnFromResponse;
import com.towinly.passon.dto.PassOnItemRequest;
import com.towinly.passon.dto.PassOnItemResponse;
import com.towinly.passon.dto.PassOnMineResponse;
import com.towinly.passon.dto.PassOnSetupResponse;
import com.towinly.passon.dto.PassOnSheetResponse;
import com.towinly.passon.dto.SealedItemRequest;
import com.towinly.passon.dto.SealedItemSummary;
import com.towinly.passon.dto.SealedRevealRequest;
import com.towinly.passon.dto.SealedRevealResponse;
import com.towinly.passon.service.KeyholderService;
import com.towinly.passon.service.PassOnService;
import com.towinly.passon.service.SealedBoxService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * What an elder passes on: her Story box and her Letters.
 *
 * The caller is read from the session on every single route and never from the request body,
 * so no call here can write in somebody else's name or read a page as somebody else.
 *
 * <p>Most of the Sealed box appears here as the arrangement <em>around</em> it — who holds a
 * key, how many must agree, and the week she has to change her mind. Exactly one route on this
 * controller returns a word of what is inside a box: {@code POST /sealed/{id}/reveal}, and only
 * to the owner, only against her re-typed password, and only outside the seven days after a
 * credential change. Every rule behind that lives in {@code SealedBoxService.reveal}; nothing
 * here re-decides any of it.
 */
@RestController
@RequestMapping("/api/passon")
@RequiredArgsConstructor
public class PassOnController {

    private final PassOnService passOnService;
    private final KeyholderService keyholderService;
    private final SealedBoxService sealedBoxService;

    /** Her own page — everything she has written, whoever it is for. */
    @GetMapping("/mine")
    public ResponseEntity<PassOnMineResponse> mine(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.mine(userId));
    }

    @PostMapping("/items")
    public ResponseEntity<PassOnItemResponse> create(
            Authentication auth,
            @Valid @RequestBody PassOnItemRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.create(userId, request));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<PassOnItemResponse> update(
            Authentication auth,
            @PathVariable UUID itemId,
            @Valid @RequestBody PassOnItemRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.update(userId, itemId, request));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable UUID itemId) {
        UUID userId = UUID.fromString(auth.getName());
        passOnService.delete(userId, itemId);
        return ResponseEntity.noContent().build();
    }

    /**
     * "From Margaret": what this visitor, and only this visitor, may read of one elder's
     * writing. Every item is checked one at a time by {@code PassOnVisibilityService}.
     */
    @GetMapping("/from/{ownerId}")
    public ResponseEntity<PassOnFromResponse> from(Authentication auth, @PathVariable UUID ownerId) {
        UUID viewerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(passOnService.from(viewerId, ownerId));
    }

    // ── Keyholders ──
    //
    // Two sides, and never the same person on both. Everything under /keyholders is the
    // elder acting on her own list; everything under /keyholders/asked-of-me is the person
    // she asked, answering for themselves. Which side you are on is decided by the session,
    // so no request can put words in the other person's mouth.

    /** Her own "Who can open it one day" list, with every status on it. */
    @GetMapping("/keyholders")
    public ResponseEntity<List<KeyholderResponse>> keyholders(Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(keyholderService.mine(ownerId));
    }

    @PostMapping("/keyholders")
    public ResponseEntity<KeyholderResponse> askSomeone(
            Authentication auth,
            @Valid @RequestBody KeyholderInviteRequest request) {
        UUID ownerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(keyholderService.invite(ownerId, request.getPersonId()));
    }

    /**
     * Takes one person's key back. No alert goes anywhere, and it takes effect at once —
     * see the note on {@code KeyholderService.remove} before changing that.
     */
    @DeleteMapping("/keyholders/{keyholderId}")
    public ResponseEntity<Void> takeTheKeyBack(Authentication auth, @PathVariable UUID keyholderId) {
        UUID ownerId = UUID.fromString(auth.getName());
        keyholderService.remove(ownerId, keyholderId);
        return ResponseEntity.noContent().build();
    }

    /** What has been asked of me, on my own screen, in my own words. */
    @GetMapping("/keyholders/asked-of-me")
    public ResponseEntity<List<KeyholderAskResponse>> askedOfMe(Authentication auth) {
        UUID personId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(keyholderService.askedOfMe(personId));
    }

    @PostMapping("/keyholders/{keyholderId}/respond")
    public ResponseEntity<Void> respond(
            Authentication auth,
            @PathVariable UUID keyholderId,
            @Valid @RequestBody KeyholderRespondRequest request) {
        UUID personId = UUID.fromString(auth.getName());
        keyholderService.respond(personId, keyholderId, request.getAccept());
        return ResponseEntity.noContent().build();
    }

    /** "You can change your mind whenever you like" has to be a real button. */
    @PostMapping("/keyholders/{keyholderId}/resign")
    public ResponseEntity<Void> resign(Authentication auth, @PathVariable UUID keyholderId) {
        UUID personId = UUID.fromString(auth.getName());
        keyholderService.resign(personId, keyholderId);
        return ResponseEntity.noContent().build();
    }

    // ── setting the Sealed box up, and the week to change her mind ──
    //
    // Nothing here opens a box or reads a word out of one. These three routes are the
    // arrangement around it: who she picked, how many must agree, and the one tap that takes
    // the whole thing back.

    /** Where she stands, including what would stop her finishing, before she starts. */
    @GetMapping("/setup")
    public ResponseEntity<PassOnSetupResponse> setup(Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(sealedBoxService.setup(ownerId));
    }

    /**
     * The last step. Everybody she picked is asked from inside this one call, so backing out
     * of the setup earlier has asked nobody anything.
     */
    @PostMapping("/arm")
    public ResponseEntity<Void> arm(
            Authentication auth,
            @Valid @RequestBody PassOnArmRequest request) {
        UUID ownerId = UUID.fromString(auth.getName());
        sealedBoxService.arm(ownerId, request);
        return ResponseEntity.noContent().build();
    }

    /**
     * "If this was not your idea, undo it." Quiet, like taking one key back — see
     * {@code SealedBoxService.undoSetup} before adding any notification here.
     */
    @PostMapping("/undo")
    public ResponseEntity<Void> undo(Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        sealedBoxService.undoSetup(ownerId);
        return ResponseEntity.noContent().build();
    }

    // ── what is in the box ──
    //
    // Four routes, and the only way anything ever goes into or comes out of a Sealed box.
    //
    // The owner is the signed-in person on every one of them, as everywhere else here. What is
    // different is that the item is looked up by (id, owner) together inside the service, so a
    // guessed id belonging to somebody else is a plain "not found" rather than a refusal: a
    // "you may not open that" would confirm to a stranger that the id is a real item belonging
    // to a real person, which is already more than they should be able to learn.
    //
    // Every rule about opening one — the lockout, the freeze, the password — is in
    // SealedBoxService.reveal and is deliberately not repeated here. A second copy of a
    // disclosure rule is a second place for it to drift.

    /** What is in her box, by name only. Never a body — see {@code SealedItemSummary}. */
    @GetMapping("/sealed")
    public ResponseEntity<List<SealedItemSummary>> sealedItems(Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(sealedBoxService.list(ownerId));
    }

    /** Puts one thing in. It is encrypted before anything is written, including its name. */
    @PostMapping("/sealed")
    public ResponseEntity<SealedItemSummary> addToTheBox(
            Authentication auth,
            @Valid @RequestBody SealedItemRequest request) {
        UUID ownerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(sealedBoxService.add(ownerId, request));
    }

    /**
     * Opens one thing, for its owner, against her password.
     *
     * <p>The password is read from the body and never from the path or a query string: those
     * are written into access logs, browser history and referrer headers, and this one opens
     * the whole account.
     *
     * <p><b>no-store, and it matters.</b> This is the only response in Towinly that carries a
     * bank account number or the place a key is hidden. Without it the answer sits in the
     * browser's disk cache and in any proxy on the way, so a box she opened once stays readable
     * on the machine long after she has signed out — which is the shared family laptop this
     * feature exists to survive.
     */
    @PostMapping("/sealed/{itemId}/reveal")
    public ResponseEntity<SealedRevealResponse> reveal(
            Authentication auth,
            @PathVariable UUID itemId,
            @Valid @RequestBody SealedRevealRequest request) {
        UUID ownerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(sealedBoxService.reveal(ownerId, itemId, request.getPassword()));
    }

    /** Takes one thing out. Her own record still shows that something was taken out. */
    @DeleteMapping("/sealed/{itemId}")
    public ResponseEntity<Void> takeOutOfTheBox(Authentication auth, @PathVariable UUID itemId) {
        UUID ownerId = UUID.fromString(auth.getName());
        sealedBoxService.delete(ownerId, itemId);
        return ResponseEntity.noContent().build();
    }

    // ── the saved copy ──
    //
    // The one page she takes out of the app and keeps where her family would look. It carries
    // the names of what is in the box and never a word of what any of it says: the service
    // builds it on SealedBoxService.list, which unwraps names only.

    /** What her one-page copy is built from. Her own, always — there is no owner in the path. */
    @GetMapping("/sheet")
    public ResponseEntity<PassOnSheetResponse> sheet(Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(sealedBoxService.sheet(ownerId));
    }

    /** She has taken a copy out. Noted, so the page can stop telling her she has not. */
    @PostMapping("/sheet/saved")
    public ResponseEntity<Void> sheetSaved(Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        sealedBoxService.markSheetSaved(ownerId);
        return ResponseEntity.noContent().build();
    }
}
