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
