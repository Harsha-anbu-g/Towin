package com.towin.connection.repository;

import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.connection.entity.Connection;
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
