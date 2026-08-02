package com.towinly.passon.repository;

import com.towinly.passon.entity.SealedItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SealedItemRepository extends JpaRepository<SealedItem, UUID> {

    List<SealedItem> findByOwnerIdOrderBySortOrderAscCreatedAtAsc(UUID ownerId);

    // Ownership is checked in the query, not after it, so a guessed id is a miss, never a read.
    Optional<SealedItem> findByIdAndOwnerId(UUID id, UUID ownerId);

    // How many things are in the box, for the account-deletion confirmation. A count is the
    // only thing about a Sealed box that can be answered without the master key, and it is
    // all the warning needs.
    long countByOwnerId(UUID ownerId);

    // GDPR purge, and the demo reset.
    void deleteByOwnerId(UUID ownerId);
}
