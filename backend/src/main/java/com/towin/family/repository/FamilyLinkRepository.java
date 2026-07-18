package com.towin.family.repository;

import com.towin.common.enums.FamilyLinkStatus;
import com.towin.family.entity.FamilyLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FamilyLinkRepository extends JpaRepository<FamilyLink, UUID> {

    long countByElderIdAndStatusIn(UUID elderId, Collection<FamilyLinkStatus> statuses);

    List<FamilyLink> findByElderIdAndStatus(UUID elderId, FamilyLinkStatus status);

    List<FamilyLink> findByFamilyUserIdAndStatus(UUID familyUserId, FamilyLinkStatus status);

    Optional<FamilyLink> findByElderIdAndFamilyUserId(UUID elderId, UUID familyUserId);

    // Daily request rate limit (10/day per user). Reused terminal rows keep their
    // original created_at, so a re-request doesn't count — acceptable slack.
    long countByInitiatedByIdAndCreatedAtAfter(UUID initiatedById, LocalDateTime after);

    // Pending requests seen from either side of the link (elder or family member),
    // regardless of which side initiated — callers split incoming/outgoing by initiatedBy.
    @Query("SELECT f FROM FamilyLink f WHERE (f.elder.id = :userId OR f.familyUser.id = :userId) AND f.status = :status")
    List<FamilyLink> findByParticipantAndStatus(@Param("userId") UUID userId, @Param("status") FamilyLinkStatus status);

    // GDPR export: every link the user participates in, both directions, all statuses.
    List<FamilyLink> findByElderIdOrFamilyUserId(UUID elderId, UUID familyUserId);

    // GDPR purge: a participant is always elder or familyUser, so this also
    // clears every row where they are initiatedBy (the initiator is one of the two).
    void deleteByElderIdOrFamilyUserId(UUID elderId, UUID familyUserId);
}
