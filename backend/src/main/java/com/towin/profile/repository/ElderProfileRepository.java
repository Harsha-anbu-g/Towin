package com.towin.profile.repository;

import com.towin.profile.entity.ElderProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ElderProfileRepository extends JpaRepository<ElderProfile, UUID> {
    Optional<ElderProfile> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);

    @Query("SELECT p FROM ElderProfile p WHERE p.user.isActive = true AND p.user.locationLat IS NOT NULL AND p.user.id != :excludeUserId")
    List<ElderProfile> findAllActiveWithLocation(@org.springframework.data.repository.query.Param("excludeUserId") UUID excludeUserId);

    void deleteByUserId(UUID userId);
}
