package com.towin.common.repository;

import com.towin.common.entity.User;
import com.towin.common.enums.VerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    Optional<User> findByUsername(String username);
    Optional<User> findByEmailVerificationToken(String token);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    boolean existsByUsername(String username);

    List<User> findByVerificationStatus(VerificationStatus status);

    @Query("""
        SELECT u FROM User u
        WHERE (u.role = com.towin.common.enums.UserRole.ELDER
               OR u.role = com.towin.common.enums.UserRole.BOTH)
          AND u.isActive = true
          AND (
                (u.lastSeenAt IS NOT NULL AND u.lastSeenAt < :cutoff)
                OR (u.lastSeenAt IS NULL AND u.createdAt < :cutoff)
              )
          AND (u.inactivityAlertedAt IS NULL OR u.inactivityAlertedAt < :alertCutoff)
        """)
    List<User> findInactiveElders(
        @Param("cutoff") LocalDateTime cutoff,
        @Param("alertCutoff") LocalDateTime alertCutoff);
}
