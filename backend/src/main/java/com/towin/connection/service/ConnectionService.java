package com.towin.connection.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.messaging.ConnectionEvent;
import com.towin.common.messaging.ConnectionEventProducer;
import com.towin.common.repository.UserRepository;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.dto.ConnectionResponse;
import com.towin.connection.dto.RespondToConnectionRequest;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.messaging.repository.MessageRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConnectionService {

    private static final int MAX_REQUESTS_PER_DAY = 10;

    private int activeLimit(User user) {
        return switch (user.getRole()) {
            case HELPER -> 1;
            case ELDER  -> 2;
            case BOTH   -> 1; // stricter — can act as helper
            default     -> Integer.MAX_VALUE;
        };
    }

    private void enforceActiveLimit(User user) {
        int active = connectionRepository.findByUserAndStatus(user.getId(), ConnectionStatus.ACTIVE).size();
        int limit  = activeLimit(user);
        if (active >= limit) {
            throw new IllegalArgumentException(
                user.getRole() + " connection limit reached (" + limit + "). End an existing connection first.");
        }
    }

    private final ConnectionRepository connectionRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final Optional<ConnectionEventProducer> eventProducer;
    private final MessageRepository messageRepository;

    @Transactional
    public ConnectionResponse sendRequest(UUID senderId, ConnectionRequest request) {
        if (senderId.equals(request.getTargetUserId())) {
            throw new IllegalArgumentException("Cannot send a connection request to yourself");
        }

        User sender = getUser(senderId);
        User target = getUser(request.getTargetUserId());

        connectionRepository.findBetweenUsers(senderId, target.getId()).ifPresent(c -> {
            throw new IllegalArgumentException("A connection already exists between these users");
        });

        enforceActiveLimit(sender);
        enforceActiveLimit(target);

        long recentCount = connectionRepository.countRequestsSince(senderId, LocalDateTime.now().minusDays(1));
        if (recentCount >= MAX_REQUESTS_PER_DAY) {
            throw new IllegalArgumentException("Daily connection request limit reached");
        }

        int senderScore = sender.getTrustScore() != null ? sender.getTrustScore() : 0;
        TrustLevel startLevel = TrustLevel.DISCOVERED;
        if (senderScore >= 71) startLevel = TrustLevel.VERIFIED;
        else if (senderScore >= 51) startLevel = TrustLevel.PHONE_CALL;

        Connection connection = Connection.builder()
                .userA(sender)
                .userB(target)
                .type(request.getType())
                .status(ConnectionStatus.PENDING)
                .initiatedBy(sender)
                .requestMessage(request.getRequestMessage())
                .currentTrustLevel(startLevel)
                .build();

        connection.setConfirmedByUser(senderId, true);

        Connection saved = connectionRepository.save(connection);
        eventProducer.ifPresent(p -> p.send(ConnectionEvent.builder()
                .type(ConnectionEvent.Type.REQUEST_SENT)
                .connectionId(saved.getId())
                .senderId(senderId)
                .recipientId(target.getId())
                .build()));
        return toResponse(saved, senderId);
    }

    @Transactional
    public ConnectionResponse respond(UUID responderId, UUID connectionId, RespondToConnectionRequest request) {
        Connection connection = getConnection(connectionId);

        if (!connection.isParticipant(responderId)) {
            throw new IllegalArgumentException("You are not part of this connection");
        }
        if (connection.getInitiatedBy().getId().equals(responderId)) {
            throw new IllegalArgumentException("Initiator cannot respond to their own request");
        }
        if (connection.getStatus() != ConnectionStatus.PENDING) {
            throw new IllegalArgumentException("Connection is not pending");
        }

        ConnectionEvent.Type eventType;
        if (Boolean.TRUE.equals(request.getAccept())) {
            enforceActiveLimit(connection.getUserA());
            enforceActiveLimit(connection.getUserB());
            connection.setStatus(ConnectionStatus.ACTIVE);
            connection.setConfirmedByUser(connection.getUserA().getId(), false);
            connection.setConfirmedByUser(connection.getUserB().getId(), false);
            eventType = ConnectionEvent.Type.REQUEST_ACCEPTED;
        } else {
            connection.setStatus(ConnectionStatus.DECLINED);
            eventType = ConnectionEvent.Type.REQUEST_DECLINED;
        }

        Connection saved = connectionRepository.save(connection);
        final ConnectionEvent.Type emitType = eventType;
        eventProducer.ifPresent(p -> p.send(ConnectionEvent.builder()
                .type(emitType)
                .connectionId(saved.getId())
                .senderId(responderId)
                .recipientId(connection.getInitiatedBy().getId())
                .build()));
        return toResponse(saved, responderId);
    }

    @Transactional
    public void endConnection(UUID userId, UUID connectionId) {
        Connection connection = getConnection(connectionId);
        if (!connection.isParticipant(userId)) {
            throw new IllegalArgumentException("You are not part of this connection");
        }
        if (connection.getStatus() != ConnectionStatus.ACTIVE) {
            throw new IllegalArgumentException("Only active connections can be ended");
        }
        connection.setStatus(ConnectionStatus.ENDED);
        connectionRepository.save(connection);
    }

    public List<ConnectionResponse> getMyConnections(UUID userId, ConnectionStatus status) {
        List<Connection> connections = (status != null)
                ? connectionRepository.findByUserAndStatus(userId, status)
                : connectionRepository.findAllByUser(userId);

        return connections.stream()
                .map(c -> toResponse(c, userId))
                .collect(Collectors.toList());
    }

    private ConnectionResponse toResponse(Connection connection, UUID viewerUserId) {
        User other = connection.getOtherUser(viewerUserId);
        String otherName = resolveDisplayName(other);

        boolean phoneUnlocked = connection.getCurrentTrustLevel().getValue() >= TrustLevel.PHONE_CALL.getValue();

        var last = messageRepository.findFirstByConnectionIdOrderByCreatedAtDesc(connection.getId());
        String preview = last.map(m -> m.getContent().length() > 60
                ? m.getContent().substring(0, 57) + "…"
                : m.getContent()).orElse(null);
        java.time.LocalDateTime lastAt = last.map(com.towin.messaging.entity.Message::getCreatedAt).orElse(null);
        int unread = (int) messageRepository.countByConnectionIdAndSenderIdNotAndSeenAtIsNull(connection.getId(), viewerUserId);

        return ConnectionResponse.builder()
                .id(connection.getId())
                .otherUserId(other.getId())
                .otherUserName(otherName)
                .type(connection.getType())
                .status(connection.getStatus())
                .currentTrustLevel(connection.getCurrentTrustLevel())
                .confirmedByMe(connection.isConfirmedByUser(viewerUserId))
                .confirmedByOther(connection.isConfirmedByUser(other.getId()))
                .initiatedByMe(connection.getInitiatedBy().getId().equals(viewerUserId))
                .requestMessage(connection.getRequestMessage())
                .otherUserPhone(phoneUnlocked ? other.getPhone() : null)
                .createdAt(connection.getCreatedAt())
                .updatedAt(connection.getUpdatedAt())
                .lastMessagePreview(preview)
                .lastMessageAt(lastAt)
                .unreadCount(unread)
                .build();
    }

    private String resolveDisplayName(User user) {
        Optional<ElderProfile> elder = elderProfileRepository.findByUserId(user.getId());
        if (elder.isPresent()) return elder.get().getName();

        Optional<HelperProfile> helper = helperProfileRepository.findByUserId(user.getId());
        if (helper.isPresent()) return helper.get().getName();

        return user.getEmail();
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }

    private Connection getConnection(UUID connectionId) {
        return connectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found: " + connectionId));
    }
}
