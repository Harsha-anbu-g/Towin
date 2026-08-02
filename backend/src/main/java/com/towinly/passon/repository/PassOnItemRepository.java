package com.towinly.passon.repository;

import com.towinly.common.enums.PassOnKind;
import com.towinly.passon.entity.PassOnItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PassOnItemRepository extends JpaRepository<PassOnItem, UUID> {

    // The elder's own page, one call per tab.
    List<PassOnItem> findByOwnerIdAndKindOrderByCreatedAtDesc(UUID ownerId, PassOnKind kind);

    // Everything one elder wrote, before PassOnVisibilityService filters it for the visitor,
    // and the same list the GDPR export walks. The filtering is never done here — a finder
    // that returned "what this person may read" would become a second authority on
    // visibility, and there can only be one.
    List<PassOnItem> findByOwnerIdOrderByCreatedAtDesc(UUID ownerId);

    // Ownership is checked in the query, not after it, so a wrong id is a 404 and never a read.
    Optional<PassOnItem> findByIdAndOwnerId(UUID id, UUID ownerId);

    // Letters addressed to one person, for a "letters waiting for you" screen. No production
    // caller yet — and this is the one finder here that would leak if the screen were written
    // carelessly, so it gets the loudest warning: it returns letters held until after the writer
    // is gone alongside the rest, and whether those may be shown at all is decided by ReleaseGate
    // through PassOnVisibilityService. Put every row through that service, exactly as
    // PassOnService.from does. The filtering is never done here — a finder that returned "what
    // this person may read" would become a second authority on visibility, and there can only be
    // one. Getting this wrong hands a living woman's last letter to its reader years early.
    List<PassOnItem> findByAudienceUserIdOrderByCreatedAtDesc(UUID audienceUserId);

    // What the account-deletion confirmation counts, so somebody about to press Delete is
    // told what goes with it. Counted rather than listed — the warning needs a number, and
    // loading every story to size a list would read the bodies for nothing.
    long countByOwnerIdAndKind(UUID ownerId, PassOnKind kind);

    // GDPR purge, and the demo reset. Rows addressed to the departing user are handled by
    // the ON DELETE SET NULL on audience_user_id, which is why that check is one-directional.
    void deleteByOwnerId(UUID ownerId);
}
