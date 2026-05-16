package com.towin.emergency.repository;

import com.towin.emergency.entity.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, UUID> {
    List<EmergencyContact> findByElderId(UUID elderId);
    long countByElderId(UUID elderId);

    @Modifying
    @Query("DELETE FROM EmergencyContact e WHERE e.elder.id = :elderId")
    void deleteByElderId(@Param("elderId") UUID elderId);
}
