package com.towin.messaging.repository;

import com.towin.messaging.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {
    Page<Message> findByConnectionIdOrderByCreatedAtDesc(UUID connectionId, Pageable pageable);
    long countByConnectionIdAndSeenAtIsNull(UUID connectionId);
}
