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

    // Letters addressed to one person, for "letters waiting for you".
    List<PassOnItem> findByAudienceUserIdOrderByCreatedAtDesc(UUID audienceUserId);

    // GDPR purge, and the demo reset. Rows addressed to the departing user are handled by
    // the ON DELETE SET NULL on audience_user_id, which is why that check is one-directional.
    void deleteByOwnerId(UUID ownerId);
}
