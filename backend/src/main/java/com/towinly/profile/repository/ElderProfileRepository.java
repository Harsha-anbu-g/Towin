package com.towinly.profile.repository;

import com.towinly.profile.entity.ElderProfile;
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

    // SEC-07 completion: the bounded variant discovery actually pages from. The box
    // encloses the search radius, so the in-memory distance sort and radius cut see
    // every row they used to — the database just stops shipping the whole directory.
    // (A row with only half a coordinate fails the BETWEEN and drops out, exactly as
    // the service's own hasStoredCell filter dropped it.)
    @Query("SELECT p FROM ElderProfile p JOIN FETCH p.user u WHERE u.isActive = true AND u.id != :excludeUserId "
            + "AND u.locationLat BETWEEN :minLat AND :maxLat AND u.locationLng BETWEEN :minLng AND :maxLng")
    List<ElderProfile> findAllActiveWithLocationInBox(
            @org.springframework.data.repository.query.Param("excludeUserId") UUID excludeUserId,
            @org.springframework.data.repository.query.Param("minLat") java.math.BigDecimal minLat,
            @org.springframework.data.repository.query.Param("maxLat") java.math.BigDecimal maxLat,
            @org.springframework.data.repository.query.Param("minLng") java.math.BigDecimal minLng,
            @org.springframework.data.repository.query.Param("maxLng") java.math.BigDecimal maxLng);

    /** Display names for a batch of user ids in one query: rows of [userId, name]. */
    @Query("SELECT p.user.id, p.name FROM ElderProfile p WHERE p.user.id IN :userIds")
    List<Object[]> findNamesByUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);

    /** Name, photo and age for a batch of user ids in one query: rows of [userId, name, photoUrl, age]. */
    @Query("SELECT p.user.id, p.name, p.photoUrl, p.age FROM ElderProfile p WHERE p.user.id IN :userIds")
    List<Object[]> findProfileCardsByUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);

    void deleteByUserId(UUID userId);
}
