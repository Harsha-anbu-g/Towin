package com.towin.messaging.repository;

import com.towin.messaging.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {
    Page<Message> findByConnectionIdOrderByCreatedAtAsc(UUID connectionId, Pageable pageable);
    Page<Message> findByConnectionIdOrderByCreatedAtDesc(UUID connectionId, Pageable pageable);
    // Channel-scoped history (V40): keeps FAMILY_UPDATES notes out of the private MAIN chat.
    Page<Message> findByConnectionIdAndChannelOrderByCreatedAtDesc(
            UUID connectionId, com.towin.common.enums.MessageChannel channel, Pageable pageable);
    long countByConnectionIdAndSeenAtIsNull(UUID connectionId);
    long countByConnectionId(UUID connectionId);
    long countByConnectionIdAndChannel(UUID connectionId, com.towin.common.enums.MessageChannel channel);

    java.util.Optional<Message> findFirstByConnectionIdOrderByCreatedAtDesc(UUID connectionId);
    long countByConnectionIdAndSenderIdNotAndSeenAtIsNull(UUID connectionId, UUID senderId);

    /** Newest message of every listed connection in one query, scoped to ONE channel:
     *  rows of [connectionId, content, createdAt]. Channel-scoped so FAMILY_UPDATES
     *  notes never surface as the private chat's preview. */
    @Query("""
        SELECT m.connection.id, m.content, m.createdAt FROM Message m
        WHERE m.connection.id IN :connectionIds
          AND m.channel = :channel
          AND m.createdAt = (SELECT MAX(m2.createdAt) FROM Message m2
                             WHERE m2.connection.id = m.connection.id AND m2.channel = :channel)
        """)
    java.util.List<Object[]> findLatestByConnectionIds(
            @Param("connectionIds") java.util.Collection<UUID> connectionIds,
            @Param("channel") com.towin.common.enums.MessageChannel channel);

    /** Unread count of every listed connection in one query, scoped to ONE channel
     *  (family notes must not light up the private chat badge): rows of [connectionId, count]. */
    @Query("""
        SELECT m.connection.id, COUNT(m) FROM Message m
        WHERE m.connection.id IN :connectionIds
          AND m.channel = :channel
          AND m.sender.id <> :viewerId
          AND m.seenAt IS NULL
        GROUP BY m.connection.id
        """)
    java.util.List<Object[]> countUnreadByConnectionIds(
            @Param("connectionIds") java.util.Collection<UUID> connectionIds,
            @Param("viewerId") UUID viewerId,
            @Param("channel") com.towin.common.enums.MessageChannel channel);

    // One UPDATE for the whole conversation — the chat polls this every few seconds,
    // so it must never load the messages just to stamp them.
    // flush first so a message sent in the same transaction is included; clear after so
    // the persistence context cannot overwrite the stamped rows with its stale copies.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        UPDATE Message m SET m.seenAt = :now
        WHERE m.connection.id = :connectionId
          AND m.channel = :channel
          AND m.sender.id <> :viewerId
          AND m.seenAt IS NULL
        """)
    int markSeenByConnectionId(@Param("connectionId") UUID connectionId,
                               @Param("viewerId") UUID viewerId,
                               @Param("now") java.time.LocalDateTime now,
                               @Param("channel") com.towin.common.enums.MessageChannel channel);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.connection.id = :connectionId")
    void deleteByConnectionId(@Param("connectionId") UUID connectionId);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.sender.id = :userId OR m.connection.userA.id = :userId OR m.connection.userB.id = :userId")
    void deleteByConnectionUserIdOrSenderId(@Param("userId") UUID userId);
}
