package com.towin.family.repository;

import com.towin.family.entity.FamilyStandingControl;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FamilyStandingControlRepository extends JpaRepository<FamilyStandingControl, UUID> {

    Optional<FamilyStandingControl> findByFamilyUserIdAndElderConnectionId(UUID familyUserId, UUID elderConnectionId);
}
