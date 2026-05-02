package com.towin.profile.repository;

import com.towin.profile.entity.ElderProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ElderProfileRepository extends JpaRepository<ElderProfile, UUID> {
    Optional<ElderProfile> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
}
