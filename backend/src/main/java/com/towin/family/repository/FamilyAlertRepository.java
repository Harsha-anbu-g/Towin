package com.towin.family.repository;

import com.towin.family.entity.FamilyAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FamilyAlertRepository extends JpaRepository<FamilyAlert, UUID> {

    // Alert feed for a family member: all of their linked elders' alerts, newest first.
    List<FamilyAlert> findByElderIdInOrderByCreatedAtDesc(Collection<UUID> elderIds);
}
