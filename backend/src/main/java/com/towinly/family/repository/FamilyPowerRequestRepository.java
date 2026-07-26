package com.towinly.family.repository;

import com.towinly.common.enums.DelegatedPower;
import com.towinly.common.enums.PowerRequestStatus;
import com.towinly.family.entity.FamilyPowerRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FamilyPowerRequestRepository extends JpaRepository<FamilyPowerRequest, UUID> {

    /** The open asks driving the elder's approval cards and the family side's waiting state. */
    List<FamilyPowerRequest> findByElderIdAndFamilyUserIdAndStatus(UUID elderId, UUID familyUserId, PowerRequestStatus status);

    Optional<FamilyPowerRequest> findByElderIdAndFamilyUserIdAndPowerAndStatus(
            UUID elderId, UUID familyUserId, DelegatedPower power, PowerRequestStatus status);

    /** Most recent answered ask for this power — its respondedAt drives the re-ask cooldown. */
    Optional<FamilyPowerRequest> findTopByElderIdAndFamilyUserIdAndPowerAndStatusInOrderByRespondedAtDesc(
            UUID elderId, UUID familyUserId, DelegatedPower power, Collection<PowerRequestStatus> statuses);

    /** Unlinking clears open asks so an ex-family member's request can't linger or be approved. */
    @Modifying
    void deleteByElderIdAndFamilyUserIdAndStatus(UUID elderId, UUID familyUserId, PowerRequestStatus status);

    /** GDPR export: every ask this person sits on either side of. */
    List<FamilyPowerRequest> findByElderIdOrFamilyUserId(UUID elderId, UUID familyUserId);

    /** GDPR purge and the demo reset. */
    @Modifying
    void deleteByElderIdOrFamilyUserId(UUID elderId, UUID familyUserId);
}
