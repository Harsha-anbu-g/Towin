package com.towinly.profile.repository;

import com.towinly.profile.entity.HelperProfile;
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
    //
    // R2-DISC: the name is now true. Without the two location tests, a helper who never
    // shared a location was loaded anyway, given a manufactured distance of nought, and
    // so sorted ahead of every real neighbour and passed any radius. Both halves of the
    // coordinate are checked, because a latitude on its own cannot be measured from
    // (PUT /api/profile/location accepts one without the other).
    @Query("SELECT p FROM HelperProfile p JOIN FETCH p.user u WHERE u.isActive = true "
            + "AND u.locationLat IS NOT NULL AND u.locationLng IS NOT NULL AND u.id != :excludeUserId")
    List<HelperProfile> findAllActiveWithLocation(@org.springframework.data.repository.query.Param("excludeUserId") UUID excludeUserId);

    // SEC-07 completion: the bounded variant discovery actually pages from — see
    // ElderProfileRepository.findAllActiveWithLocationInBox for the contract.
    @Query("SELECT p FROM HelperProfile p JOIN FETCH p.user u WHERE u.isActive = true AND u.id != :excludeUserId "
            + "AND u.locationLat BETWEEN :minLat AND :maxLat AND u.locationLng BETWEEN :minLng AND :maxLng")
    List<HelperProfile> findAllActiveWithLocationInBox(
            @org.springframework.data.repository.query.Param("excludeUserId") UUID excludeUserId,
            @org.springframework.data.repository.query.Param("minLat") java.math.BigDecimal minLat,
            @org.springframework.data.repository.query.Param("maxLat") java.math.BigDecimal maxLat,
            @org.springframework.data.repository.query.Param("minLng") java.math.BigDecimal minLng,
            @org.springframework.data.repository.query.Param("maxLng") java.math.BigDecimal maxLng);

    /** Display names and photos for a batch of user ids in one query: rows of [userId, name, photoUrl]. */
    @Query("SELECT p.user.id, p.name, p.photoUrl FROM HelperProfile p WHERE p.user.id IN :userIds")
    List<Object[]> findNamesAndPhotosByUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);

    /** Name, photo and age for a batch of user ids in one query: rows of [userId, name, photoUrl, age]. */
    @Query("SELECT p.user.id, p.name, p.photoUrl, p.age FROM HelperProfile p WHERE p.user.id IN :userIds")
    List<Object[]> findProfileCardsByUserIds(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<UUID> userIds);

    void deleteByUserId(UUID userId);
}
