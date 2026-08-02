package com.towinly.passon.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Everything the elder's saved one-page copy is built from.
 *
 * <h2>This is the one payload that leaves the building</h2>
 * The sheet is downloaded as a file and kept outside Towinly — in a drawer, on a desktop, read
 * by somebody in the week after a death. So the rule here is stricter than on any screen:
 * {@link #items} is a list of {@link SealedItemSummary}, which <b>has no body field</b>, and the
 * service that fills it unwraps names through {@code SealedCryptoService.openLabel} only. The
 * contents of the box are never turned back into readable text on this path at all, so there is
 * nothing for a later change to accidentally carry into the file.
 *
 * <p>Nothing here is a sentence. "2 of the 3 must agree" and "Sarah said yes on 2 June" are
 * built on the screen from {@code passOnLocks.js}, so the saved copy, the elder's own page and
 * the acceptance card say the same thing in the same words.
 *
 * @param preparedAt  the server's clock at the moment the copy was asked for, so the file can
 *                    say when it was made. A sheet with no date is worthless to a family
 *                    holding two of them.
 * @param lastSavedAt when she last took a copy out of the app, or null if she never has —
 *                    which is the honest answer to "do not let this app be your only copy".
 * @param releaseContactEmail the address a family writes to when the day comes, from
 *                    {@code SEALED_BOX_RELEASE_CONTACT_EMAIL}, or <b>null when none is set</b>.
 *                    Null is a real answer the page renders in plain words. It must never be
 *                    filled in with a placeholder here or on the screen: this address is
 *                    printed on a page a family keeps with the will, and one that looks real
 *                    but cannot receive mail swallows their letter in silence.
 */
public record PassOnSheetResponse(

        String ownerName,

        LocalDateTime preparedAt,

        boolean armed,

        /** How many of the people below must agree. Null before she has set anything up. */
        Short approvalsNeeded,

        /** How many she asked altogether. Null before she has set anything up. */
        Short keyholderTarget,

        /** What is in the box, by name only. */
        List<SealedItemSummary> items,

        List<KeyholderResponse> keyholders,

        LocalDateTime lastSavedAt,

        /** Who the family writes to, or null when no address has been set. Never a placeholder. */
        String releaseContactEmail
) {}
