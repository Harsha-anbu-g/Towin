package com.towinly.passon.service;

import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.TrustLevel;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.entity.SealedItem;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * The sole authority on who may read one thing an elder wrote. Every read path calls this and
 * nothing else decides — a finder that returned "what this person may read" would become a
 * second authority, and there can only be one.
 *
 * Every answer is DERIVED on the spot and never stored, in the {@link
 * com.towinly.family.service.FamilyStandingService} style: a family link revoked this morning,
 * or a friendship that ended, stops granting a read on the very next call without a single row
 * being rewritten. There is no database-level backstop on any of this, so this class and
 * {@code PassOnVisibilityServiceTest} are the whole mitigation.
 *
 * The audience the elder picked is her stated intent, never the answer by itself:
 *
 *   EVERYONE — anyone signed in, including someone she has never met.
 *   FAMILY   — an ACTIVE family link, with her in the elder seat (the page is elder-only).
 *   HELPERS  — a live friendship that reached the top of the trust ladder. Never a
 *              coordination chat, and never a stranger who connected this week.
 *   PERSON   — that one person and nobody else, not even her family.
 */
@Service
@RequiredArgsConstructor
public class PassOnVisibilityService {

    private final FamilyLinkRepository familyLinkRepository;
    private final ConnectionRepository connectionRepository;

    /** May this reader open this story or letter, right now? */
    @Transactional(readOnly = true)
    public boolean canRead(PassOnItem item, UUID viewerId) {
        if (item == null || viewerId == null) return false;

        UUID ownerId = item.getOwner().getId();
        // Her own page, always — no audience, no link and no ladder stands between a person
        // and what she wrote herself.
        if (ownerId.equals(viewerId)) return true;

        // AFTER is legal in the schema so the later release needs no migration, but nothing
        // may be handed out that the app cannot yet deliver properly.
        if (item.getReleaseWhen() != PassOnRelease.NOW) return false;

        return switch (item.getAudience()) {
            case EVERYONE -> true;
            case FAMILY -> hasActiveFamilyLink(ownerId, viewerId);
            case HELPERS -> hasFullyTrustedFriendship(ownerId, viewerId);
            // The named person may have closed their account, which sets the column null.
            // That must read as "nobody", never as "everybody".
            case PERSON -> item.getAudienceUser() != null
                    && item.getAudienceUser().getId().equals(viewerId);
        };
    }

    /**
     * The Sealed box has no visibility path at all — not for family, not for a Keyholder, and
     * not for the owner either. The owner reads an item back through {@code SealedBoxService},
     * which asks for her password every single time. This overload exists so that a caller
     * reaching for {@code canRead} on a sealed item gets a plain, permanent no.
     */
    @Transactional(readOnly = true)
    public boolean canRead(SealedItem item, UUID viewerId) {
        return false;
    }

    /** On her family list today, in the elder seat — a revoked or pending link grants nothing. */
    private boolean hasActiveFamilyLink(UUID ownerId, UUID viewerId) {
        return familyLinkRepository.findByElderIdAndFamilyUserId(ownerId, viewerId)
                .map(FamilyLink::getStatus)
                .filter(status -> status == FamilyLinkStatus.ACTIVE)
                .isPresent();
    }

    /**
     * "The helpers you have built up trust with": a live friendship standing at the top of the
     * ladder. FAMILY-type rows are coordination chats that never earn trust, so they are
     * excluded here exactly as they are in {@code FamilyStandingService.toStanding}.
     */
    private boolean hasFullyTrustedFriendship(UUID ownerId, UUID viewerId) {
        return connectionRepository.findBetweenUsers(ownerId, viewerId)
                .filter(c -> c.getType() != ConnectionType.FAMILY)
                .filter(c -> c.getStatus() == ConnectionStatus.ACTIVE)
                .filter(this::isFullyTrusted)
                .isPresent();
    }

    private boolean isFullyTrusted(Connection connection) {
        TrustLevel level = connection.getCurrentTrustLevel();
        return level != null && level.getValue() >= TrustLevel.TRUSTED.getValue();
    }
}
