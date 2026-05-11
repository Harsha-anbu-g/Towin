package com.towin.connection.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.messaging.ConnectionEvent;
import com.towin.common.messaging.ConnectionEventProducer;
import com.towin.common.repository.UserRepository;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.dto.ConnectionResponse;
import com.towin.connection.dto.RespondToConnectionRequest;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
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

    private final ConnectionRepository connectionRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ConnectionEventProducer eventProducer;

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

        long recentCount = connectionRepository.countRequestsSince(senderId, LocalDateTime.now().minusDays(1));
        if (recentCount >= MAX_REQUESTS_PER_DAY) {
            throw new IllegalArgumentException("Daily connection request limit reached");
        }

        Connection connection = Connection.builder()
                .userA(sender)
                .userB(target)
                .type(request.getType())
                .status(ConnectionStatus.PENDING)
                .initiatedBy(sender)
                .requestMessage(request.getRequestMessage())
                .build();

        connection.setConfirmedByUser(senderId, true);

        Connection saved = connectionRepository.save(connection);
        eventProducer.send(ConnectionEvent.builder()
                .type(ConnectionEvent.Type.REQUEST_SENT)
                .connectionId(saved.getId())
                .senderId(senderId)
                .recipientId(target.getId())
                .build());
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
            connection.setConfirmedByUser(responderId, true);
            connection.setStatus(ConnectionStatus.ACTIVE);
            eventType = ConnectionEvent.Type.REQUEST_ACCEPTED;
        } else {
            connection.setStatus(ConnectionStatus.DECLINED);
            eventType = ConnectionEvent.Type.REQUEST_DECLINED;
        }

        Connection saved = connectionRepository.save(connection);
        eventProducer.send(ConnectionEvent.builder()
                .type(eventType)
                .connectionId(saved.getId())
                .senderId(responderId)
                .recipientId(connection.getInitiatedBy().getId())
                .build());
        return toResponse(saved, responderId);
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

        return ConnectionResponse.builder()
                .id(connection.getId())
                .otherUserId(other.getId())
                .otherUserName(otherName)
                .type(connection.getType())
                .status(connection.getStatus())
                .currentTrustLevel(connection.getCurrentTrustLevel())
                .confirmedByMe(connection.isConfirmedByUser(viewerUserId))
                .initiatedByMe(connection.getInitiatedBy().getId().equals(viewerUserId))
                .requestMessage(connection.getRequestMessage())
                .createdAt(connection.getCreatedAt())
                .updatedAt(connection.getUpdatedAt())
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
