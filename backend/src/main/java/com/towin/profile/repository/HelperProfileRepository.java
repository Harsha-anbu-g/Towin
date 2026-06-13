package com.towin.profile.repository;

import com.towin.profile.entity.HelperProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HelperProfileRepository extends JpaRepository<HelperProfile, UUID> {
    Optional<HelperProfile> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);

    @Query("SELECT p FROM HelperProfile p WHERE p.user.isActive = true AND p.user.id != :excludeUserId")
    List<HelperProfile> findAllActiveWithLocation(@org.springframework.data.repository.query.Param("excludeUserId") UUID excludeUserId);

    void deleteByUserId(UUID userId);
}
