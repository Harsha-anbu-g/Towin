package com.towinly.block.repository;

import com.towinly.block.entity.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserBlockRepository extends JpaRepository<UserBlock, UUID> {

    Optional<UserBlock> findByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);

    List<UserBlock> findAllByBlockerIdOrderByCreatedAtDesc(UUID blockerId);

    @Modifying
    void deleteByBlockerIdAndBlockedId(UUID blockerId, UUID blockedId);

    /**
     * Everyone hidden from this user, in BOTH directions: the people they blocked and the
     * people who blocked them. One query, ids only; the listings subtract the set.
     */
    @Query("""
        SELECT CASE WHEN b.blocker.id = :userId THEN b.blocked.id ELSE b.blocker.id END
        FROM UserBlock b
        WHERE b.blocker.id = :userId OR b.blocked.id = :userId
        """)
    List<UUID> findHiddenUserIds(@Param("userId") UUID userId);

    /** True when either of the two has blocked the other. */
    @Query("""
        SELECT COUNT(b) > 0 FROM UserBlock b
        WHERE (b.blocker.id = :a AND b.blocked.id = :b)
           OR (b.blocker.id = :b AND b.blocked.id = :a)
        """)
    boolean existsBetween(@Param("a") UUID a, @Param("b") UUID b);
}
