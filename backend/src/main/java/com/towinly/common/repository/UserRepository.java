package com.towinly.common.repository;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    Optional<User> findByUsername(String username);
    Optional<User> findByEmailVerificationToken(String token);
    Optional<User> findByPasswordResetToken(String token);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    boolean existsByUsername(String username);

    /** Ids of the accounts with these emails. The demo wall uses it with the demo list. */
    @Query("SELECT u.id FROM User u WHERE u.email IN :emails")
    List<UUID> findIdsByEmailIn(@Param("emails") java.util.Collection<String> emails);

    /** Ids of every account whose email is NOT one of these: everyone real, for a demo seat. */
    @Query("SELECT u.id FROM User u WHERE u.email NOT IN :emails")
    List<UUID> findIdsByEmailNotIn(@Param("emails") java.util.Collection<String> emails);

    List<User> findByVerificationStatus(VerificationStatus status);

    // Paged variant for the admin panel — the queue must not grow without a bound.
    List<User> findByVerificationStatus(VerificationStatus status, org.springframework.data.domain.Pageable pageable);

    /**
     * Elders who have gone quiet, for the 09:00 inactivity check.
     *
     * The roles are bound as a parameter on purpose. {@code u.role} is a Postgres named
     * enum ({@code user_role}); written as JPQL literals ({@code UserRole.ELDER}) Hibernate
     * rendered them as {@code 'ELDER'::UserRole}, a cast to the Java simple name, which
     * Postgres does not have. The query parsed, so {@code RepositoryQueryParsingTest} never
     * noticed, and the cron failed every morning in production. A bound parameter is sent
     * untyped and Postgres coerces it to the column's enum. {@code InactivityQueryDbTest}
     * runs this against a real Postgres.
     */
    @Query("""
        SELECT u FROM User u
        WHERE u.role IN :roles
          AND u.isActive = true
          AND (
                (u.lastSeenAt IS NOT NULL AND u.lastSeenAt < :cutoff)
                OR (u.lastSeenAt IS NULL AND u.createdAt < :cutoff)
              )
          AND (u.inactivityAlertedAt IS NULL OR u.inactivityAlertedAt < :alertCutoff)
        """)
    List<User> findInactiveElders(
        @Param("roles") Collection<UserRole> roles,
        @Param("cutoff") LocalDateTime cutoff,
        @Param("alertCutoff") LocalDateTime alertCutoff);

    /** The roles an elder can hold: ELDER, and BOTH (an elder who also helps). */
    default List<User> findInactiveElders(LocalDateTime cutoff, LocalDateTime alertCutoff) {
        return findInactiveElders(List.of(UserRole.ELDER, UserRole.BOTH), cutoff, alertCutoff);
    }
}
