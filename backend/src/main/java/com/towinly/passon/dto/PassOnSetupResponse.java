package com.towinly.passon.dto;

import java.time.LocalDateTime;

/**
 * Where the elder stands with her Sealed box, as the setup screen needs to know it.
 *
 * <h2>Why the two sentences travel with the state</h2>
 * The screen renders {@code notAWillAck} and {@code keyTruthAck} rather than holding its own
 * copies, and sends them back when she finishes. So there is exactly one copy of each
 * sentence in the whole product, the words she reads are the words that get hashed, and a
 * reworded checkbox cannot quietly become an acknowledgement of something she never saw.
 *
 * <h2>Why the refusals are answered before she starts</h2>
 * {@code emailConfirmed} and {@code hasPassword} are here so the last step can say what is
 * missing while she can still fix it. Letting her pick three people, choose a number and tick
 * two boxes, and only then be told her email is unconfirmed, is a small cruelty on a screen
 * about her death.
 *
 * <p>Nothing about what is <em>in</em> the box appears here.
 */
public record PassOnSetupResponse(

        /** True once she has finished setup. */
        boolean armed,

        LocalDateTime armedAt,

        /** When the seven days run out. Null before she has armed anything. */
        LocalDateTime coolingOffUntil,

        /** Whether the one-tap undo is still open right now, re-derived on every read. */
        boolean canStillUndo,

        /** How many Keyholders must agree. Null before setup. */
        Short approvalsNeeded,

        /** How many people she asked. Null before setup. */
        Short keyholderTarget,

        boolean emailConfirmed,

        /** False for a Google-only account, which has no password to keep the box shut. */
        boolean hasPassword,

        String notAWillAck,

        String keyTruthAck,

        /**
         * The address a family writes to when the day comes, or null when none is set.
         *
         * <p>Here as well as on the sheet because the refusal after a password change carries
         * "if that was not you, tell us straight away", and the screen has to finish that
         * sentence with somewhere to go. Null is a real answer and is said in plain words —
         * never filled in with a placeholder.
         */
        String releaseContactEmail
) {}
