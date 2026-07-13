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

    // JOIN FETCH: the user is read for every row (location, trust score), so load
    // it in the same query instead of one lazy select per profile (N+1).
    @Query("SELECT p FROM HelperProfile p JOIN FETCH p.user u WHERE u.isActive = true AND u.id != :excludeUserId")
    List<HelperProfile> findAllActiveWithLocation(@org.springframework.data.repository.query.Param("excludeUserId") UUID excludeUserId);

    /** Display names and photos for a batch of user ids in one query: rows of [userId, name, photoUrl]. */
    @Query("SELECT p.user.id, p.name, p.photoUrl FROM HelperProfile p WHERE p.user.id IN :userIds")
    List<Object[]> findNamesAndPhotosByUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);

    void deleteByUserId(UUID userId);
}
