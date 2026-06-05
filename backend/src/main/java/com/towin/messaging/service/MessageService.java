package com.towin.messaging.service;

import com.towin.common.entity.User;
import com.towin.common.enums.TrustLevel;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.messaging.dto.MessageRequest;
import com.towin.messaging.dto.MessageResponse;
import com.towin.messaging.entity.Message;
import com.towin.messaging.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConnectionRepository connectionRepository;

    public Page<MessageResponse> getHistory(UUID connectionId, UUID userId, Pageable pageable) {
        Connection conn = getAuthorizedConnection(connectionId, userId);
        return messageRepository.findByConnectionIdOrderByCreatedAtAsc(conn.getId(), pageable)
                .map(this::toResponse);
    }

    @Transactional
    public MessageResponse send(UUID connectionId, UUID senderId, MessageRequest request) {
        Connection conn = getAuthorizedConnection(connectionId, senderId);
        if (conn.getCurrentTrustLevel().getValue() < TrustLevel.MESSAGING.getValue()) {
            throw new IllegalStateException("Trust level too low to message");
        }
        User sender = getSenderFromConnection(conn, senderId);

        Message message = Message.builder()
                .connection(conn)
                .sender(sender)
                .content(request.getContent())
                .type(request.getType())
                .build();
        return toResponse(messageRepository.save(message));
    }

    public int totalUnreadCount(UUID userId) {
        return connectionRepository.findAllByUser(userId).stream()
                .mapToInt(c -> (int) messageRepository
                        .countByConnectionIdAndSenderIdNotAndSeenAtIsNull(c.getId(), userId))
                .sum();
    }

    @Transactional
    public void markSeen(UUID connectionId, UUID userId) {
        getAuthorizedConnection(connectionId, userId);
        messageRepository.findByConnectionIdOrderByCreatedAtAsc(connectionId, Pageable.unpaged())
                .stream()
                .filter(m -> !m.getSender().getId().equals(userId) && m.getSeenAt() == null)
                .forEach(m -> m.setSeenAt(LocalDateTime.now()));
    }

    private Connection getAuthorizedConnection(UUID connectionId, UUID userId) {
        Connection conn = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found"));
        if (!conn.isParticipant(userId)) {
            throw new IllegalStateException("Not a participant of this connection");
        }
        return conn;
    }

    private User getSenderFromConnection(Connection conn, UUID senderId) {
        if (conn.getUserA().getId().equals(senderId)) return conn.getUserA();
        return conn.getUserB();
    }

    private MessageResponse toResponse(Message m) {
        return MessageResponse.builder()
                .id(m.getId())
                .connectionId(m.getConnection().getId())
                .senderId(m.getSender().getId())
                .content(m.getContent())
                .type(m.getType())
                .seenAt(m.getSeenAt())
                .flagged(m.isFlagged())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
