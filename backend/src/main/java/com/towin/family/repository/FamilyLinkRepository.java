package com.towin.family.repository;

import com.towin.common.enums.FamilyLinkStatus;
import com.towin.family.entity.FamilyLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FamilyLinkRepository extends JpaRepository<FamilyLink, UUID> {

    long countByElderIdAndStatusIn(UUID elderId, Collection<FamilyLinkStatus> statuses);

    List<FamilyLink> findByElderIdAndStatus(UUID elderId, FamilyLinkStatus status);

    List<FamilyLink> findByFamilyUserIdAndStatus(UUID familyUserId, FamilyLinkStatus status);

    Optional<FamilyLink> findByElderIdAndFamilyUserId(UUID elderId, UUID familyUserId);

    // Pending requests seen from either side of the link (elder or family member),
    // regardless of which side initiated — callers split incoming/outgoing by initiatedBy.
    @Query("SELECT f FROM FamilyLink f WHERE (f.elder.id = :userId OR f.familyUser.id = :userId) AND f.status = :status")
    List<FamilyLink> findByParticipantAndStatus(@Param("userId") UUID userId, @Param("status") FamilyLinkStatus status);
}
