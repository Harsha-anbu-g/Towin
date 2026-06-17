package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.trust.dto.TrustActionRequest;
import com.towin.trust.dto.TrustStatusResponse;
import com.towin.trust.entity.TrustProgressionLog;
import com.towin.trust.repository.TrustProgressionLogRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.emergency.service.SosService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrustService {

    private final ConnectionRepository connectionRepository;
    private final TrustProgressionLogRepository trustLogRepository;
    private final UserRepository userRepository;
    private final SosService sosService;
    private final TrustScoreService trustScoreService;

    @Transactional
    public TrustStatusResponse confirmTrustLevel(UUID userId, UUID connectionId, TrustActionRequest request) {
        Connection connection = getActiveConnection(connectionId, userId);

        if (connection.isConfirmedByUser(userId)) {
            throw new IllegalArgumentException("You have already confirmed the current trust level");
        }

        User user = getUser(userId);

        connection.setConfirmedByUser(userId, true);

        boolean bothConfirmed = connection.getConfirmedByA() && connection.getConfirmedByB();
        if (bothConfirmed) {
            TrustLevel from = connection.getCurrentTrustLevel();
            TrustLevel to = from.next();

            if (to.equals(from)) {
                throw new IllegalArgumentException("Already at maximum trust level");
            }

            connection.setCurrentTrustLevel(to);
            connection.setConfirmedByUser(connection.getUserA().getId(), false);
            connection.setConfirmedByUser(connection.getUserB().getId(), false);

            TrustProgressionLog logEntry = TrustProgressionLog.builder()
                    .connection(connection)
                    .fromLevel(from)
                    .toLevel(to)
                    .confirmedBy(user)
                    .note(request != null ? request.getNote() : null)
                    .build();
            trustLogRepository.save(logEntry);

            if (to == TrustLevel.FIRST_MEET) {
                UUID elderId = connection.getUserA().getRole().name().equals("ELDER")
                        ? connection.getUserA().getId()
                        : connection.getUserB().getId();
                sosService.notifyFirstMeet(elderId, connectionId);
            }

            // Each stage is a rooting point, so both sides' scores change on every advance.
            recalculateBoth(connection);
        }

        connectionRepository.save(connection);
        return buildStatusResponse(connection, userId);
    }

    @Transactional
    public TrustStatusResponse pauseProgression(UUID userId, UUID connectionId) {
        Connection connection = getActiveConnection(connectionId, userId);
        connection.setStatus(ConnectionStatus.PAUSED);
        connection.setIsPausedBy(getUser(userId));
        connectionRepository.save(connection);
        recalculateBoth(connection);
        return buildStatusResponse(connection, userId);
    }

    @Transactional
    public TrustStatusResponse resumeProgression(UUID userId, UUID connectionId) {
        Connection connection = getConnection(connectionId, userId);
        if (connection.getStatus() != ConnectionStatus.PAUSED) {
            throw new IllegalArgumentException("Connection is not paused");
        }
        connection.setStatus(ConnectionStatus.ACTIVE);
        connection.setIsPausedBy(null);
        connectionRepository.save(connection);
        recalculateBoth(connection);
        return buildStatusResponse(connection, userId);
    }

    public TrustStatusResponse getStatus(UUID userId, UUID connectionId) {
        Connection connection = getConnection(connectionId, userId);
        return buildStatusResponse(connection, userId);
    }

    private TrustStatusResponse buildStatusResponse(Connection connection, UUID viewerUserId) {
        List<TrustProgressionLog> history = trustLogRepository
                .findByConnectionIdOrderByCreatedAtDesc(connection.getId());

        UUID otherUserId = connection.getOtherUser(viewerUserId).getId();
        boolean confirmedByOther = connection.isConfirmedByUser(otherUserId);

        return TrustStatusResponse.builder()
                .connectionId(connection.getId())
                .currentLevel(connection.getCurrentTrustLevel())
                .confirmedByMe(connection.isConfirmedByUser(viewerUserId))
                .confirmedByOther(confirmedByOther)
                .canAdvance(!connection.isConfirmedByUser(viewerUserId)
                        && connection.getStatus() == ConnectionStatus.ACTIVE)
                .history(history.stream().map(log -> TrustStatusResponse.TrustLogEntry.builder()
                        .fromLevel(log.getFromLevel())
                        .toLevel(log.getToLevel())
                        .confirmedBy(log.getConfirmedBy().getId())
                        .note(log.getNote())
                        .createdAt(log.getCreatedAt())
                        .build()).collect(Collectors.toList()))
                .build();
    }

    private Connection getActiveConnection(UUID connectionId, UUID userId) {
        Connection connection = getConnection(connectionId, userId);
        if (connection.getStatus() != ConnectionStatus.ACTIVE) {
            throw new IllegalArgumentException("Connection is not active");
        }
        return connection;
    }

    private Connection getConnection(UUID connectionId, UUID userId) {
        Connection connection = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found"));
        if (!connection.isParticipant(userId)) {
            throw new IllegalArgumentException("You are not part of this connection");
        }
        return connection;
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private void recalculateBoth(Connection connection) {
        trustScoreService.recalculate(connection.getUserA().getId());
        trustScoreService.recalculate(connection.getUserB().getId());
    }
}
