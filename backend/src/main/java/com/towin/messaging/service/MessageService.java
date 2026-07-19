package com.towin.messaging.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.MessageChannel;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.messaging.dto.MessageRequest;
import com.towin.messaging.dto.MessageResponse;
import com.towin.messaging.entity.Message;
import com.towin.messaging.repository.MessageRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConnectionRepository connectionRepository;
    private final FamilyLinkRepository familyLinkRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final S3Service s3Service;
    private final com.towin.family.service.FamilyStandingService familyStandingService;

    public Page<MessageResponse> getHistory(UUID connectionId, UUID userId,
                                            MessageChannel channel, Pageable pageable) {
        Connection conn = getAuthorizedConnection(connectionId, userId, channel);
        // Page 0 returns the newest messages (so long conversations don't hide
        // recent activity). The client reverses each page to display oldest→newest.
        return messageRepository
                .findByConnectionIdAndChannelOrderByCreatedAtDesc(conn.getId(), channel, pageable)
                .map(m -> toResponse(m, conn));
    }

    @Transactional
    public MessageResponse send(UUID connectionId, UUID senderId,
                                MessageChannel channel, MessageRequest request) {
        Connection conn = getAuthorizedConnection(connectionId, senderId, channel);
        if (conn.getStatus() != ConnectionStatus.ACTIVE) {
            throw new IllegalStateException("Can only message an active connection");
        }
        // MAIN keeps its own trust gate; the FAMILY_UPDATES gate (ACTIVE + shared
        // + >= FIRST_MEET) is already enforced for family in getAuthorizedConnection,
        // and participants always keep their thread (Step 3 locked rule 1). The
        // FAMILY-type inheritance gate is enforced in getAuthorizedConnection too,
        // so a closed bridge has already thrown above.
        if (channel == MessageChannel.MAIN
                && conn.getType() != com.towin.common.enums.ConnectionType.FAMILY
                && conn.getCurrentTrustLevel().getValue() < TrustLevel.MESSAGING.getValue()) {
            throw new IllegalStateException("Trust level too low to message");
        }
        User sender = resolveSender(conn, senderId);

        Message message = Message.builder()
                .connection(conn)
                .sender(sender)
                .content(request.getContent())
                .type(request.getType())
                .channel(channel)
                .build();
        return toResponse(messageRepository.save(message), conn);
    }

    // Count of conversations (people) with at least one unread message — not the
    // total number of unread messages. Two people who messaged you reads as "2",
    // even if they sent five messages between them.
    public int unreadConversationCount(UUID userId) {
        // The navbar polls this: one grouped count for every connection, not one per row.
        // The grouped query only returns connections that have unread messages, so the
        // number of rows it gives back is the count.
        List<UUID> connectionIds = connectionRepository.findAllByUser(userId).stream()
                .map(Connection::getId)
                .collect(Collectors.toList());
        if (connectionIds.isEmpty()) return 0;
        // MAIN only — family updates must not light up the private chat badge.
        return messageRepository.countUnreadByConnectionIds(connectionIds, userId, MessageChannel.MAIN).size();
    }

    @Transactional
    public void markSeen(UUID connectionId, UUID userId) {
        getAuthorizedConnection(connectionId, userId, MessageChannel.MAIN);
        // Authorization first, then one UPDATE — the chat polls this every 5 seconds,
        // so it must not load the conversation to stamp it row by row.
        messageRepository.markSeenByConnectionId(connectionId, userId, LocalDateTime.now(), MessageChannel.MAIN);
    }

    private Connection getAuthorizedConnection(UUID connectionId, UUID userId, MessageChannel channel) {
        Connection conn = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found"));
        if (conn.isParticipant(userId)) {
            // A FAMILY-type chat exists only while an elder's shared trust bridges
            // the two people. The same derivation that opens it (chatAllowed) also
            // closes reading and seen-stamping the moment consent is withdrawn —
            // nothing is cached, so the elder flipping the share switch off (or a
            // family-side pause) severs the whole chat, not just new messages.
            if (channel == MessageChannel.MAIN
                    && conn.getType() == com.towin.common.enums.ConnectionType.FAMILY
                    && !familyStandingService.chatAllowed(conn)) {
                throw new IllegalStateException(
                        "This chat is closed right now. It opens through your family member's shared trust.");
            }
            return conn;
        }
        // Family members reach ONLY the updates thread, and only through the double
        // gate; flipping shared_with_family off cuts them immediately.
        if (channel == MessageChannel.FAMILY_UPDATES
                && familyGateHolds(conn) && hasActiveFamilyLink(conn, userId)) {
            return conn;
        }
        throw new IllegalStateException("Not a participant of this connection");
    }

    private boolean familyGateHolds(Connection conn) {
        return conn.getStatus() == ConnectionStatus.ACTIVE
                && Boolean.TRUE.equals(conn.getSharedWithFamily())
                && conn.getCurrentTrustLevel().getValue() >= TrustLevel.FIRST_MEET.getValue();
    }

    private boolean hasActiveFamilyLink(Connection conn, UUID userId) {
        return activeLinkTo(conn.getUserA().getId(), userId).isPresent()
                || activeLinkTo(conn.getUserB().getId(), userId).isPresent();
    }

    private Optional<FamilyLink> activeLinkTo(UUID elderId, UUID familyUserId) {
        return familyLinkRepository.findByElderIdAndFamilyUserId(elderId, familyUserId)
                .filter(link -> link.getStatus() == FamilyLinkStatus.ACTIVE);
    }

    private User resolveSender(Connection conn, UUID senderId) {
        if (conn.getUserA().getId().equals(senderId)) return conn.getUserA();
        if (conn.getUserB().getId().equals(senderId)) return conn.getUserB();
        // A family member writing to the updates thread is not on the connection.
        return userRepository.findById(senderId)
                .orElseThrow(() -> new IllegalArgumentException("Sender not found"));
    }

    private MessageResponse toResponse(Message m, Connection conn) {
        MessageResponse.MessageResponseBuilder builder = MessageResponse.builder()
                .id(m.getId())
                .connectionId(m.getConnection().getId())
                .senderId(m.getSender().getId())
                .content(m.getContent())
                .type(m.getType())
                .seenAt(m.getSeenAt())
                .flagged(m.isFlagged())
                .createdAt(m.getCreatedAt())
                .channel(m.getChannel());
        if (m.getChannel() == MessageChannel.FAMILY_UPDATES) {
            // Name + photo + plain relationship words only — never phone/email
            // (Step 3 locked rule 3: no contact-detail leakage to family).
            User sender = m.getSender();
            String name = displayName(sender);
            builder.senderName(name)
                    .senderPhotoUrl(photoUrl(sender))
                    .senderLabel(senderLabel(sender, name, conn));
        }
        return builder.build();
    }

    /** The sender's proper name, plain and warm (user call 2026-07-19) — the
     *  thread's own context already says who is family and who is the helper. */
    private String senderLabel(User sender, String name, Connection conn) {
        return name;
    }

    private String displayName(User user) {
        return elderProfileRepository.findByUserId(user.getId()).map(ElderProfile::getName)
                .or(() -> helperProfileRepository.findByUserId(user.getId()).map(HelperProfile::getName))
                .filter(this::notBlank)
                .orElseGet(() -> notBlank(user.getFullName()) ? user.getFullName() : user.getUsername());
    }

    private String photoUrl(User user) {
        return elderProfileRepository.findByUserId(user.getId()).map(ElderProfile::getPhotoUrl)
                .or(() -> helperProfileRepository.findByUserId(user.getId()).map(HelperProfile::getPhotoUrl))
                .filter(this::notBlank)
                .map(s3Service::presignedUrl)
                .orElse(null);
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
