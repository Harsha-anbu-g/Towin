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

    // JOIN FETCH: the user is read for every row (location, trust score), so load
    // it in the same query instead of one lazy select per profile (N+1).
    @Query("SELECT p FROM ElderProfile p JOIN FETCH p.user u WHERE u.isActive = true AND u.locationLat IS NOT NULL AND u.id != :excludeUserId")
    List<ElderProfile> findAllActiveWithLocation(@org.springframework.data.repository.query.Param("excludeUserId") UUID excludeUserId);

    /** Display names for a batch of user ids in one query: rows of [userId, name]. */
    @Query("SELECT p.user.id, p.name FROM ElderProfile p WHERE p.user.id IN :userIds")
    List<Object[]> findNamesByUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);

    void deleteByUserId(UUID userId);
}
