package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.DelegatedPower;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.family.service.FamilyDelegationService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.trust.dto.TrustActionRequest;
import com.towin.trust.dto.TrustStatusResponse;
import com.towin.trust.entity.TrustProgressionLog;
import com.towin.trust.repository.TrustProgressionLogRepository;
import com.towin.common.service.DisplayNameResolver;
import com.towin.common.service.TrustScoreService;
import com.towin.emergency.service.SosService;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
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
    private final FamilyDelegationService familyDelegationService;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;

    @Transactional
    public TrustStatusResponse confirmTrustLevel(UUID callerId, UUID connectionId, TrustActionRequest request) {
        Connection connection = findConnection(connectionId);

        // Guardian mode: a family member the elder trusts with ADVANCE_TRUST takes
        // the elder's seat here. Working out the seat before any other check means
        // every rule below judges the elder — the same "are you on this connection",
        // the same "have you already confirmed", the same "whose turn is it" — so a
        // family member can never take a step the elder could not take themselves.
        User actingFor = delegatedSeatOn(connection, callerId);
        UUID seatId = actingFor == null ? callerId : actingFor.getId();

        requireParticipant(connection, seatId);
        requireActive(connection);

        // Judged against the seat, not the caller: if the elder has already confirmed,
        // their family member cannot confirm a second time in their name.
        if (connection.isConfirmedByUser(seatId)) {
            throw new IllegalArgumentException("You have already confirmed the current trust level");
        }

        User user = getUser(seatId);

        // The elder starts each step; the helper can only accept after that.
        // On FAMILY-type connections (family member ↔ helper, Step 4) the
        // connection's initiator holds that seat instead.
        boolean otherConfirmed = connection.isConfirmedByUser(connection.getOtherUser(seatId).getId());
        if (!otherConfirmed && !holdsInitiatorSeat(connection, user, seatId)) {
            throw new IllegalArgumentException(connection.getType() == com.towin.common.enums.ConnectionType.FAMILY
                    ? "Only the person who started this connection can begin the next step. You can accept it once they do."
                    : "Only the elder can start the next step. You can accept it once they do.");
        }

        connection.setConfirmedByUser(seatId, true);
        // Remember who really pressed it. Passing null when the elder pressed their
        // own button matters as much as stamping the family member: it wipes any
        // earlier stand-in, so nobody is named for a step they had no part in.
        connection.setConfirmActedByUser(seatId, actingFor == null ? null : getUser(callerId));

        boolean bothConfirmed = connection.getConfirmedByA() && connection.getConfirmedByB();
        if (bothConfirmed) {
            TrustLevel from = connection.getCurrentTrustLevel();
            TrustLevel to = from.next();

            if (to.equals(from)) {
                throw new IllegalArgumentException("Already at maximum trust level");
            }

            // A step is only real once both seats have agreed, and a family member
            // can only ever take the FIRST of those two presses — the elder starts
            // each step, and this row is written on the helper's reply. So the
            // person to name is usually the one remembered on the other seat, not
            // whoever happened to finish it just now. Read both, this seat first.
            User steppedFor = connection.getConfirmActedByUser(seatId);
            if (steppedFor == null) {
                steppedFor = connection.getConfirmActedByUser(connection.getOtherUser(seatId).getId());
            }

            connection.setCurrentTrustLevel(to);
            connection.resetConfirmations();

            TrustProgressionLog logEntry = TrustProgressionLog.builder()
                    .connection(connection)
                    .fromLevel(from)
                    .toLevel(to)
                    .confirmedBy(user)
                    // Stamped only when a family member took the step for them, so the
                    // history says who was actually there.
                    .actedBy(steppedFor)
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
        return buildStatusResponse(connection, seatId);
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

    public TrustStatusResponse getStatus(UUID callerId, UUID connectionId) {
        Connection connection = findConnection(connectionId);
        // Seeing where the trust has got to is part of moving it along — nobody can
        // sensibly take the next step blind. So the same family member who may
        // advance it may read it, from the elder's seat and no wider.
        User actingFor = delegatedSeatOn(connection, callerId);
        UUID seatId = actingFor == null ? callerId : actingFor.getId();
        requireParticipant(connection, seatId);
        return buildStatusResponse(connection, seatId);
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
                        // Guardian mode: a step someone took for their parent says so
                        // here, on every screen that shows the history. A step is a
                        // real moment between two people, so who was actually at the
                        // keyboard for it can never be left out.
                        .actedByName(log.getActedBy() == null ? null : displayName(log.getActedBy()))
                        .actedByUserId(log.getActedBy() == null ? null : log.getActedBy().getId())
                        .note(log.getNote())
                        .createdAt(log.getCreatedAt())
                        .build()).collect(Collectors.toList()))
                .build();
    }

    private Connection getActiveConnection(UUID connectionId, UUID userId) {
        Connection connection = getConnection(connectionId, userId);
        requireActive(connection);
        return connection;
    }

    private Connection getConnection(UUID connectionId, UUID userId) {
        Connection connection = findConnection(connectionId);
        requireParticipant(connection, userId);
        return connection;
    }

    private Connection findConnection(UUID connectionId) {
        return connectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found"));
    }

    private void requireParticipant(Connection connection, UUID userId) {
        if (!connection.isParticipant(userId)) {
            throw new IllegalArgumentException("You are not part of this connection");
        }
    }

    private void requireActive(Connection connection) {
        if (connection.getStatus() != ConnectionStatus.ACTIVE) {
            throw new IllegalArgumentException("Connection is not active");
        }
    }

    /**
     * The person on this connection whose seat the caller is taking, or null when
     * the caller is simply themselves.
     *
     * Narrow on purpose: someone already on the connection is only ever themselves,
     * and only a participant who has actually granted ADVANCE_TRUST on a friendship
     * they are sharing can be spoken for. The sharing and the grant are re-read on
     * every call, so the moment the elder takes either back the very next step is
     * refused. Nothing here trusts the client.
     */
    private User delegatedSeatOn(Connection connection, UUID callerId) {
        if (connection.isParticipant(callerId)) return null;
        return List.of(connection.getUserA(), connection.getUserB()).stream()
                .filter(participant -> familyDelegationService.hasPowerOn(
                        callerId, participant.getId(), DelegatedPower.ADVANCE_TRUST, connection))
                .findFirst()
                .orElse(null);
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

    /** The person's own name, resolved the same way reviews and messages do it. */
    private String displayName(User user) {
        return DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, user);
    }

    private void recalculateBoth(Connection connection) {
        trustScoreService.recalculate(connection.getUserA().getId());
        trustScoreService.recalculate(connection.getUserB().getId());
    }
}
