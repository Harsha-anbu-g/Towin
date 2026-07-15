package com.towin.connection.repository;

import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.connection.entity.Connection;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConnectionRepository extends JpaRepository<Connection, UUID> {

    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :userId OR c.userB.id = :userId) AND c.status = :status")
    List<Connection> findByUserAndStatus(@Param("userId") UUID userId, @Param("status") ConnectionStatus status);

    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :userId OR c.userB.id = :userId)")
    List<Connection> findAllByUser(@Param("userId") UUID userId);

    // Paged variants for the connection list: newest activity first, so a bounded
    // page always holds the conversations the user actually looks at.
    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :userId OR c.userB.id = :userId) AND c.status = :status ORDER BY c.updatedAt DESC")
    List<Connection> findByUserAndStatus(@Param("userId") UUID userId, @Param("status") ConnectionStatus status, Pageable pageable);

    // Live states first (ACTIVE, then PAUSED, then PENDING), terminal states last, each
    // group newest-first. The page cap must only ever truncate DECLINED/ENDED history —
    // never a live conversation the inbox is expected to show in full.
    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :userId OR c.userB.id = :userId) "
         + "ORDER BY CASE c.status "
         + "WHEN com.towin.common.enums.ConnectionStatus.ACTIVE THEN 0 "
         + "WHEN com.towin.common.enums.ConnectionStatus.PAUSED THEN 1 "
         + "WHEN com.towin.common.enums.ConnectionStatus.PENDING THEN 2 "
         + "ELSE 3 END, c.updatedAt DESC")
    List<Connection> findAllByUser(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :a AND c.userB.id = :b) OR (c.userA.id = :b AND c.userB.id = :a)")
    Optional<Connection> findBetweenUsers(@Param("a") UUID userAId, @Param("b") UUID userBId);

    @Query("SELECT COUNT(c) FROM Connection c WHERE c.initiatedBy.id = :userId AND c.createdAt >= :since")
    long countRequestsSince(@Param("userId") UUID userId, @Param("since") LocalDateTime since);

    @Query("SELECT COUNT(c) FROM Connection c WHERE (c.userA.id = :userId OR c.userB.id = :userId) AND c.currentTrustLevel = :trusted AND c.status = :active")
    long countTrustedByUser(@Param("userId") UUID userId, @Param("trusted") TrustLevel trusted, @Param("active") ConnectionStatus active);

    @Modifying
    @Query("DELETE FROM Connection c WHERE c.userA.id = :userId OR c.userB.id = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
