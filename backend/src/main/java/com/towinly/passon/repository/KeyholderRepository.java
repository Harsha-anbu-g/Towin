package com.towinly.passon.repository;

import com.towinly.common.enums.KeyholderStatus;
import com.towinly.passon.entity.Keyholder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KeyholderRepository extends JpaRepository<Keyholder, UUID> {

    // The elder's own list, every status, so she can see "David has not answered yet".
    List<Keyholder> findByOwnerIdOrderByInvitedAtAsc(UUID ownerId);

    List<Keyholder> findByOwnerIdAndStatus(UUID ownerId, KeyholderStatus status);

    // Counts toward the threshold, but only alongside a live family link — the caller
    // re-derives that on every read rather than trusting this number alone.
    long countByOwnerIdAndStatus(UUID ownerId, KeyholderStatus status);

    // The other side: what this person has been asked to hold, for the acceptance card.
    List<Keyholder> findByKeyholderIdAndStatus(UUID keyholderId, KeyholderStatus status);

    Optional<Keyholder> findByOwnerIdAndKeyholderId(UUID ownerId, UUID keyholderId);

    // The elder acting on one row of her own list. Ownership is part of the query, so
    // somebody else's row id is a plain not-found and never a read.
    Optional<Keyholder> findByIdAndOwnerId(UUID id, UUID ownerId);

    // GDPR export: both sides of the relationship.
    List<Keyholder> findByOwnerIdOrKeyholderId(UUID ownerId, UUID keyholderId);

    // GDPR purge, and the demo reset.
    void deleteByOwnerIdOrKeyholderId(UUID ownerId, UUID keyholderId);
}
