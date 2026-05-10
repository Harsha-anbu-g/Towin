package com.towin.emergency.repository;

import com.towin.emergency.entity.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, UUID> {
    List<EmergencyContact> findByElderId(UUID elderId);
    long countByElderId(UUID elderId);
}
