package com.towin.family.repository;

import com.towin.common.enums.DelegatedPower;
import com.towin.family.entity.FamilyDelegatedPower;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.UUID;

public interface FamilyDelegatedPowerRepository extends JpaRepository<FamilyDelegatedPower, UUID> {

    List<FamilyDelegatedPower> findByElderIdAndFamilyUserId(UUID elderId, UUID familyUserId);

    /** The gate every delegated action uses: does this family member hold this power for this elder? */
    boolean existsByElderIdAndFamilyUserIdAndPower(UUID elderId, UUID familyUserId, DelegatedPower power);

    @Modifying
    void deleteByElderIdAndFamilyUserId(UUID elderId, UUID familyUserId);

    @Modifying
    void deleteByElderIdAndFamilyUserIdAndPower(UUID elderId, UUID familyUserId, DelegatedPower power);
}
