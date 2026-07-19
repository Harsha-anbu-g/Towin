package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
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

        // The elder starts each step; the helper can only accept after that.
        // On FAMILY-type connections (family member ↔ helper, Step 4) the
        // connection's initiator holds that seat instead.
        boolean otherConfirmed = connection.isConfirmedByUser(connection.getOtherUser(userId).getId());
        if (!otherConfirmed && !holdsInitiatorSeat(connection, user, userId)) {
            throw new IllegalArgumentException(connection.getType() == com.towin.common.enums.ConnectionType.FAMILY
                    ? "Only the person who started this connection can begin the next step. You can accept it once they do."
                    : "Only the elder can start the next step. You can accept it once they do.");
        }

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

            // FAMILY-type connections have no elder participant — the meeting is
            // between a family member and a helper, so no emergency-contact notice.
            if (to == TrustLevel.FIRST_MEET && connection.getType() != com.towin.common.enums.ConnectionType.FAMILY) {
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
        User viewer = connection.getOtherUser(otherUserId);

        return TrustStatusResponse.builder()
                .connectionId(connection.getId())
                .currentLevel(connection.getCurrentTrustLevel())
                .confirmedByMe(connection.isConfirmedByUser(viewerUserId))
                .confirmedByOther(confirmedByOther)
                .canAdvance(!connection.isConfirmedByUser(viewerUserId)
                        && connection.getStatus() == ConnectionStatus.ACTIVE
                        && (holdsInitiatorSeat(connection, viewer, viewerUserId) || confirmedByOther))
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

    private static boolean actsAsElder(User user) {
        return user.getRole() == UserRole.ELDER || user.getRole() == UserRole.BOTH;
    }

    /** Who may start the next ladder step: the elder on normal connections, the
     *  connection's initiator on FAMILY-type ones (Step 4). */
    private static boolean holdsInitiatorSeat(Connection connection, User user, UUID userId) {
        if (connection.getType() == com.towin.common.enums.ConnectionType.FAMILY) {
            return connection.getInitiatedBy() != null
                    && connection.getInitiatedBy().getId().equals(userId);
        }
        return actsAsElder(user);
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
