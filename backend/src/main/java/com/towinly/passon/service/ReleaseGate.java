package com.towinly.passon.service;

import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.repository.PassOnSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Has a person's release happened yet? One question, one answer, one place.
 *
 * <h2>Why this is its own class</h2>
 * Two very different rules turn on the same fact. A letter she addressed "after I am gone"
 * becomes readable by the person she named ({@link PassOnVisibilityService}), and at the same
 * moment it stops being hers to edit or take down ({@link PassOnService}). Two copies of
 * "released means…" would drift, and the drift would show up as a bereaved daughter reading a
 * letter her mother had since rewritten — or as a live elder locked out of her own writing.
 *
 * <h2>Nothing here ever sets it</h2>
 * There is no {@code release(...)} method on this class, and that is the design rather than an
 * omission. No scheduler, no timer, no admin screen, no endpoint: {@code released_at} is set by
 * a person running the last step of {@code docs/operations/sealed-box-release.md} by hand,
 * after a death certificate has been read, after the elder's own quorum of Keyholders has each
 * agreed separately, and after thirty days in which nobody could reach her. Every automatic
 * design was looked at and every one of them opens a living person's box.
 *
 * <h2>It fails shut</h2>
 * An owner with no settings row has never set a Sealed box up, so there is no row to carry a
 * release and no Keyholders to have agreed to one. That reads as "not released", which is the
 * only safe way for a missing row to read.
 */
@Service
@RequiredArgsConstructor
public class ReleaseGate {

    /**
     * One sentence, everywhere the freeze refuses something on the "What I pass on" pages —
     * her stories and letters, her Sealed box, and the arrangement of Keyholders around it.
     *
     * <p>It lives here rather than in any one service because whoever reads it is hitting
     * whichever route they happened to be on, and being told two slightly different things
     * about the same fact is how a bereaved family come to believe the app is broken. The
     * account-deletion refusal is deliberately NOT this sentence: that one names the address
     * to write to, so it carries a value and lives with the code that has one.
     */
    public static final String ALREADY_PASSED_ON =
            "What is kept here was passed on to the people it was meant for. Nothing can be "
                    + "added, changed or taken down now.";

    /**
     * The Sealed box refuses differently, because opening is not adding, changing or taking down
     * and being told the wrong sentence at the worst moment is its own small cruelty.
     *
     * <p>It names somewhere to write. This is the likeliest place a family member meets a wall
     * while genuinely trying to reach what she left them, and "no" with no next step is how they
     * conclude the app has swallowed it. When no address is configured it says so plainly rather
     * than leaving a gap or printing a plausible mailbox nobody reads — {@code ReleaseContact}'s
     * rule everywhere else.
     */
    static String boxCannotBeOpened(String contactEmail) {
        return BOX_CANNOT_BE_OPENED
                + (contactEmail == null
                        ? "Towinly has not set an address to write to yet."
                        : "If you need to talk to somebody about it, write to " + contactEmail + ".");
    }

    /** Constant prefix, so GlobalExceptionHandler can allow the sentence through by its start. */
    static final String BOX_CANNOT_BE_OPENED =
            "This box was passed on to the people it was meant for, so it cannot be opened here "
                    + "any more. ";

    private final PassOnSettingsRepository settings;

    /** True only once a person has run the release procedure for this owner. */
    @Transactional(readOnly = true)
    public boolean isReleased(UUID ownerId) {
        if (ownerId == null) return false;
        return settings.findById(ownerId)
                .map(PassOnSettings::getReleasedAt)
                .isPresent();
    }
}
