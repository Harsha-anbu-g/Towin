package com.towin.connection.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import com.towin.common.exception.ForbiddenException;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConnectionService {

    private static final int MAX_REQUESTS_PER_DAY = 10;

    // The list callers (dashboards, inbox) filter the whole array client-side, so the
    // default page has to clear a user's own hard limits: 20 active connections for a
    // helper plus pending requests. Pass ?page=&size= to walk further back.
    // Generous on purpose: the batched read is a fixed 3 queries regardless of size, so
    // this only bounds a pathological payload. Live connections are ordered ahead of
    // terminal ones (see ConnectionRepository.findAllByUser), so no real user's active
    // conversations are ever truncated — only very long DECLINED/ENDED history is.
    public static final int DEFAULT_PAGE_SIZE = 100;

    private int activeLimit(User user) {
        return switch (user.getRole()) {
            case HELPER -> 20;
            case ELDER  -> 10;
            case BOTH   -> 10;
            default     -> Integer.MAX_VALUE;
        };
    }

    private void enforceActiveLimit(User user) {
        // FAMILY-type connections (Step 4) are coordination-only and never eat
        // into anyone's elder/helper capacity.
        int active = (int) connectionRepository.findByUserAndStatus(user.getId(), ConnectionStatus.ACTIVE).stream()
                .filter(c -> c.getType() != com.towin.common.enums.ConnectionType.FAMILY)
                .count();
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
    private final com.towin.common.service.TrustScoreService trustScoreService;
    private final com.towin.common.service.S3Service s3Service;
    private final com.towin.family.repository.FamilyLinkRepository familyLinkRepository;

    @Transactional
    public ConnectionResponse sendRequest(UUID senderId, ConnectionRequest request) {
        if (senderId.equals(request.getTargetUserId())) {
            throw new IllegalArgumentException("Cannot send a connection request to yourself");
        }

        User sender = getUser(senderId);
        User target = getUser(request.getTargetUserId());

        connectionRepository.findBetweenUsers(senderId, target.getId()).ifPresent(c -> {
            if (c.getStatus() == ConnectionStatus.PENDING || c.getStatus() == ConnectionStatus.ACTIVE) {
                throw new IllegalArgumentException("A connection already exists between these users");
            }
        });

        // Step 4: a pair that already holds an ACTIVE family link is always typed
        // FAMILY (a daughter helping her own mother earns no points), and FAMILY
        // connections skip capacity limits and the score-based head start.
        com.towin.common.enums.ConnectionType type = resolveType(sender, target, request.getType());
        boolean isFamilyType = type == com.towin.common.enums.ConnectionType.FAMILY;

        if (!isFamilyType) {
            enforceActiveLimit(sender);
            enforceActiveLimit(target);
        }

        long recentCount = connectionRepository.countRequestsSince(senderId, LocalDateTime.now().minusDays(1));
        if (recentCount >= MAX_REQUESTS_PER_DAY) {
            throw new IllegalArgumentException("Daily connection request limit reached");
        }

        int senderScore = sender.getTrustScore() != null ? (int) Math.round(sender.getTrustScore()) : 0;
        TrustLevel startLevel = TrustLevel.DISCOVERED;
        if (!isFamilyType) {
            if (senderScore >= 71) startLevel = TrustLevel.VERIFIED;
            else if (senderScore >= 51) startLevel = TrustLevel.PHONE_CALL;
        }

        Connection connection = Connection.builder()
                .userA(sender)
                .userB(target)
                .type(type)
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

    /**
     * The connection type is server-derived, never taken on trust from the client.
     * Only a real ACTIVE family link between the pair yields FAMILY; a client that
     * asks for FAMILY without one is downgraded to SOCIAL, so the FAMILY exemptions
     * (no capacity cap, no points, no trust ladder) can never be spoofed.
     */
    private com.towin.common.enums.ConnectionType resolveType(
            User sender, User target, com.towin.common.enums.ConnectionType requested) {
        boolean familyLinked = hasActiveFamilyLink(sender.getId(), target.getId())
                || hasActiveFamilyLink(target.getId(), sender.getId());
        if (familyLinked) return com.towin.common.enums.ConnectionType.FAMILY;
        return requested == com.towin.common.enums.ConnectionType.FAMILY
                ? com.towin.common.enums.ConnectionType.SOCIAL
                : requested;
    }

    private boolean hasActiveFamilyLink(UUID elderId, UUID familyUserId) {
        return familyLinkRepository.findByElderIdAndFamilyUserId(elderId, familyUserId)
                .filter(l -> l.getStatus() == com.towin.common.enums.FamilyLinkStatus.ACTIVE)
                .isPresent();
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
            // FAMILY-type connections never consume capacity: sendRequest already
            // skips the cap for them, and accepting must not re-impose it.
            if (connection.getType() != com.towin.common.enums.ConnectionType.FAMILY) {
                enforceActiveLimit(connection.getUserA());
                enforceActiveLimit(connection.getUserB());
            }
            connection.setStatus(ConnectionStatus.ACTIVE);
            connection.resetConfirmations();
            eventType = ConnectionEvent.Type.REQUEST_ACCEPTED;
        } else {
            connection.setStatus(ConnectionStatus.DECLINED);
            eventType = ConnectionEvent.Type.REQUEST_DECLINED;
        }

        Connection saved = connectionRepository.save(connection);

        if (saved.getStatus() == ConnectionStatus.ACTIVE) {
            // A new active customer = the first "Connected" rooting point for both sides.
            trustScoreService.recalculate(saved.getUserA().getId());
            trustScoreService.recalculate(saved.getUserB().getId());
        }

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

        // Customer is no longer active — drop their points from both scores.
        trustScoreService.recalculate(connection.getUserA().getId());
        trustScoreService.recalculate(connection.getUserB().getId());
    }

    /**
     * US-006: the elder participant chooses, per friendship, whether their linked
     * family can see it. Elder seat = role ELDER/BOTH (same rule as FamilyService);
     * the helper side of the connection gets a 403, never a silent no-op.
     */
    @Transactional
    public ConnectionResponse setFamilyVisibility(UUID callerId, UUID connectionId, boolean shared) {
        Connection connection = getConnection(connectionId);
        if (!connection.isParticipant(callerId)) {
            throw new IllegalArgumentException("You are not part of this connection");
        }
        User caller = connection.getUserA().getId().equals(callerId)
                ? connection.getUserA() : connection.getUserB();
        boolean elderSeat = caller.getRole() == UserRole.ELDER || caller.getRole() == UserRole.BOTH;
        if (!elderSeat) {
            throw new ForbiddenException("Only the elder can choose whether family sees this friendship");
        }
        connection.setSharedWithFamily(shared);
        return toResponse(connectionRepository.save(connection), callerId);
    }

    public List<ConnectionResponse> getMyConnections(UUID userId, ConnectionStatus status) {
        return getMyConnections(userId, status, PageRequest.of(0, DEFAULT_PAGE_SIZE));
    }

    public List<ConnectionResponse> getMyConnections(UUID userId, ConnectionStatus status, Pageable pageable) {
        List<Connection> connections = (status != null)
                ? connectionRepository.findByUserAndStatus(userId, status, pageable)
                : connectionRepository.findAllByUser(userId, pageable);

        // Three queries for the whole page — the inbox, the Messages header and the
        // navbar poll all land here, so it must never be one lookup per row.
        Map<UUID, Object[]> lastMessages = lastMessageMap(connections);
        Map<UUID, Long> unreadCounts = unreadCountMap(connections, userId);
        Map<UUID, Object[]> profiles = profileCardMap(connections, userId);

        return connections.stream()
                .map(c -> toResponse(c, userId, lastMessages, unreadCounts, profiles))
                .collect(Collectors.toList());
    }

    // The empty case is a HashMap, not Map.of(): a connection that is not persisted yet
    // has a null id, and Map.of().get(null) throws.

    /** Newest message of every connection in the list, in one query — never one lookup per row. */
    private Map<UUID, Object[]> lastMessageMap(Collection<Connection> connections) {
        Set<UUID> connectionIds = connectionIds(connections);
        if (connectionIds.isEmpty()) return new HashMap<>();
        return messageRepository.findLatestByConnectionIds(connectionIds, com.towin.common.enums.MessageChannel.MAIN).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> row, (a, b) -> a));
    }

    /** Unread count of every connection in the list, in one grouped query. */
    private Map<UUID, Long> unreadCountMap(Collection<Connection> connections, UUID viewerUserId) {
        Set<UUID> connectionIds = connectionIds(connections);
        if (connectionIds.isEmpty()) return new HashMap<>();
        return messageRepository.countUnreadByConnectionIds(connectionIds, viewerUserId, com.towin.common.enums.MessageChannel.MAIN).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));
    }

    /** Name/photo/age of every other user in the list: one query per profile table. */
    private Map<UUID, Object[]> profileCardMap(Collection<Connection> connections, UUID viewerUserId) {
        Set<UUID> otherUserIds = connections.stream()
                .map(c -> c.getOtherUser(viewerUserId).getId())
                .collect(Collectors.toSet());
        if (otherUserIds.isEmpty()) return new HashMap<>();

        Map<UUID, Object[]> cards = new HashMap<>();
        helperProfileRepository.findProfileCardsByUserIds(otherUserIds)
                .forEach(row -> cards.put((UUID) row[0], row));
        // Elder wins when a BOTH user has both profiles — same precedence as the
        // single-row resolvers below.
        elderProfileRepository.findProfileCardsByUserIds(otherUserIds)
                .forEach(row -> cards.put((UUID) row[0], row));
        return cards;
    }

    private Set<UUID> connectionIds(Collection<Connection> connections) {
        return connections.stream()
                .map(Connection::getId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
    }

    private ConnectionResponse toResponse(Connection connection, UUID viewerUserId) {
        List<Connection> one = List.of(connection);
        return toResponse(connection, viewerUserId,
                lastMessageMap(one), unreadCountMap(one, viewerUserId), profileCardMap(one, viewerUserId));
    }

    private ConnectionResponse toResponse(Connection connection, UUID viewerUserId,
                                          Map<UUID, Object[]> lastMessages,
                                          Map<UUID, Long> unreadCounts,
                                          Map<UUID, Object[]> profiles) {
        User other = connection.getOtherUser(viewerUserId);
        // Rows are [userId, name, photoUrl, age]; no profile row (e.g. FAMILY-role
        // users) = fall back to their proper name, never straight to the email.
        Object[] card = profiles.get(other.getId());
        String otherName = card != null ? (String) card[1] : plainName(other);

        boolean phoneUnlocked = connection.getCurrentTrustLevel().getValue() >= TrustLevel.PHONE_CALL.getValue();

        // Rows are [connectionId, content, createdAt].
        Object[] last = lastMessages.get(connection.getId());
        String content = last != null ? (String) last[1] : null;
        String preview = content == null ? null
                : (content.length() > 60 ? content.substring(0, 57) + "…" : content);
        java.time.LocalDateTime lastAt = last != null ? (java.time.LocalDateTime) last[2] : null;
        int unread = unreadCounts.getOrDefault(connection.getId(), 0L).intValue();

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
                .sharedWithFamily(Boolean.TRUE.equals(connection.getSharedWithFamily()))
                .requestMessage(connection.getRequestMessage())
                .otherUserPhone(phoneUnlocked ? other.getPhone() : null)
                .otherUserAge(card != null ? (Integer) card[3] : null)
                .otherUserPhotoUrl(card != null ? s3Service.presignedUrl((String) card[2]) : null)
                .createdAt(connection.getCreatedAt())
                .updatedAt(connection.getUpdatedAt())
                .lastMessagePreview(preview)
                .lastMessageAt(lastAt)
                .unreadCount(unread)
                .build();
    }

    // Single-profile resolvers. The list path above batches these lookups instead
    // (findProfileCardsByUserIds), but they stay as the authoritative one-user rules.
    private String resolveDisplayName(User user) {
        Optional<ElderProfile> elder = elderProfileRepository.findByUserId(user.getId());
        if (elder.isPresent()) return elder.get().getName();

        Optional<HelperProfile> helper = helperProfileRepository.findByUserId(user.getId());
        if (helper.isPresent()) return helper.get().getName();

        return plainName(user);
    }

    /** Proper-name fallback for users without a profile: full name → username → email. */
    private String plainName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) return user.getFullName();
        if (user.getUsername() != null && !user.getUsername().isBlank()) return user.getUsername();
        return user.getEmail();
    }

    private String resolvePhotoUrl(User user) {
        return elderProfileRepository.findByUserId(user.getId())
                .map(e -> s3Service.presignedUrl(e.getPhotoUrl()))
                .or(() -> helperProfileRepository.findByUserId(user.getId())
                        .map(h -> s3Service.presignedUrl(h.getPhotoUrl())))
                .orElse(null);
    }

    private Integer resolveAge(User user) {
        Optional<ElderProfile> elder = elderProfileRepository.findByUserId(user.getId());
        if (elder.isPresent()) return elder.get().getAge();

        Optional<HelperProfile> helper = helperProfileRepository.findByUserId(user.getId());
        if (helper.isPresent()) return helper.get().getAge();

        return null;
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
