package com.towin.profile.repository;

import com.towin.profile.entity.HelperProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface HelperProfileRepository extends JpaRepository<HelperProfile, UUID> {
    Optional<HelperProfile> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
}
