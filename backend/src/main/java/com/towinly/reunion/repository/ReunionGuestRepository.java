package com.towinly.reunion.repository;

import com.towinly.reunion.entity.ReunionGuest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ReunionGuestRepository extends JpaRepository<ReunionGuest, UUID> {
    List<ReunionGuest> findByReunionIdOrderByCreatedAtAsc(UUID reunionId);
    List<ReunionGuest> findByReunionIdInOrderByCreatedAtAsc(Collection<UUID> reunionIds);
}
