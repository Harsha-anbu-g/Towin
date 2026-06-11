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
    long countByConnectionIdAndSeenAtIsNull(UUID connectionId);

    java.util.Optional<Message> findFirstByConnectionIdOrderByCreatedAtDesc(UUID connectionId);
    long countByConnectionIdAndSenderIdNotAndSeenAtIsNull(UUID connectionId, UUID senderId);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.connection.id = :connectionId")
    void deleteByConnectionId(@Param("connectionId") UUID connectionId);

    @Modifying
    @Query("DELETE FROM Message m WHERE m.sender.id = :userId OR m.connection.userA.id = :userId OR m.connection.userB.id = :userId")
    void deleteByConnectionUserIdOrSenderId(@Param("userId") UUID userId);
}
