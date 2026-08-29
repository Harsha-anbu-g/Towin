package com.towinly.connection.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.TrustLevel;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import com.towinly.connection.dto.ConnectionRequest;
import com.towinly.connection.dto.ConnectionResponse;
import com.towinly.connection.dto.RespondToConnectionRequest;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConnectionServiceTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock com.towinly.messaging.repository.MessageRepository messageRepository;
    @Mock com.towinly.common.service.TrustScoreService trustScoreService;
    @Mock com.towinly.common.service.S3Service s3Service;
    @Mock com.towinly.family.repository.FamilyLinkRepository familyLinkRepository;
    @Mock com.towinly.block.service.BlockService blockService;
    ConnectionService connectionService;

    private User sender;
    private User target;

    @BeforeEach
    void setUp() {
        // Manual construction: the service takes Optional<ConnectionEventProducer>,
        // which @InjectMocks cannot populate
        connectionService = new ConnectionService(
                connectionRepository, userRepository, elderProfileRepository,
                helperProfileRepository, Optional.empty(), messageRepository, trustScoreService, s3Service,
                familyLinkRepository, blockService);
        sender = buildUser(UUID.randomUUID(), "sender@test.com");
        target = buildUser(UUID.randomUUID(), "target@test.com");
    }

    @Test
    void shouldSendConnectionRequest() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(sender.getId(), target.getId())).thenReturn(Optional.empty());
        when(connectionRepository.countRequestsSince(eq(sender.getId()), any(LocalDateTime.class))).thenReturn(0L);
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> {
            Connection c = i.getArgument(0);
            c.setCreatedAt(LocalDateTime.now());
            c.setUpdatedAt(LocalDateTime.now());
            return c;
        });

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());
        request.setType(ConnectionType.SOCIAL);

        ConnectionResponse response = connectionService.sendRequest(sender.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.PENDING);
        assertThat(response.isConfirmedByMe()).isTrue();
        verify(connectionRepository).save(any(Connection.class));
    }

    @Test
    void familyLinkedPair_isAutoTypedFamily_andSkipsCapacityLimits() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(sender.getId(), target.getId())).thenReturn(Optional.empty());
        when(connectionRepository.countRequestsSince(eq(sender.getId()), any(LocalDateTime.class))).thenReturn(0L);
        com.towinly.family.entity.FamilyLink link = mock(com.towinly.family.entity.FamilyLink.class);
        when(link.getStatus()).thenReturn(com.towinly.common.enums.FamilyLinkStatus.ACTIVE);
        when(familyLinkRepository.findByElderIdAndFamilyUserId(sender.getId(), target.getId()))
                .thenReturn(Optional.of(link));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> {
            Connection c = i.getArgument(0);
            c.setCreatedAt(LocalDateTime.now());
            c.setUpdatedAt(LocalDateTime.now());
            return c;
        });

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());
        request.setType(ConnectionType.SOCIAL); // requested type is overridden by the link

        connectionService.sendRequest(sender.getId(), request);

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        assertThat(captor.getValue().getType()).isEqualTo(ConnectionType.FAMILY);
        // FAMILY-type requests never consult capacity, and get no score head start.
        verify(connectionRepository, never()).findByUserAndStatus(any(), any());
        assertThat(captor.getValue().getCurrentTrustLevel())
                .isEqualTo(com.towinly.common.enums.TrustLevel.DISCOVERED);
    }

    @Test
    void spoofedFamilyTypeWithoutALinkIsDowngradedToSocialAndHitsTheCap() {
        // Security: only a real family link may produce a FAMILY connection.
        // A stranger requesting type FAMILY must not slip past the capacity cap.
        java.util.List<Connection> tenSocial = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            tenSocial.add(Connection.builder()
                    .id(UUID.randomUUID()).userA(sender)
                    .userB(buildUser(UUID.randomUUID(), "s" + i + "@test.com"))
                    .status(ConnectionStatus.ACTIVE)
                    .type(ConnectionType.SOCIAL)
                    .build());
        }
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(sender.getId(), target.getId())).thenReturn(Optional.empty());
        // No family link either direction — familyLinkRepository returns empty by default.
        when(connectionRepository.findByUserAndStatus(sender.getId(), ConnectionStatus.ACTIVE)).thenReturn(tenSocial);

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());
        request.setType(ConnectionType.FAMILY); // spoofed — no family link backs it

        assertThatThrownBy(() -> connectionService.sendRequest(sender.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("limit");
        verify(connectionRepository, never()).save(any(Connection.class));
    }

    @Test
    void activeLimit_ignoresFamilyTypeConnections() {
        // Sender (elder, limit 10) sits at 10 ACTIVE connections — but all FAMILY-type,
        // so a normal SOCIAL request still goes through.
        java.util.List<Connection> familyOnly = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            familyOnly.add(Connection.builder()
                    .id(UUID.randomUUID()).userA(sender)
                    .userB(buildUser(UUID.randomUUID(), "fam" + i + "@test.com"))
                    .status(ConnectionStatus.ACTIVE)
                    .type(ConnectionType.FAMILY)
                    .build());
        }
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(sender.getId(), target.getId())).thenReturn(Optional.empty());
        when(connectionRepository.countRequestsSince(eq(sender.getId()), any(LocalDateTime.class))).thenReturn(0L);
        when(connectionRepository.findByUserAndStatus(sender.getId(), ConnectionStatus.ACTIVE)).thenReturn(familyOnly);
        when(connectionRepository.findByUserAndStatus(target.getId(), ConnectionStatus.ACTIVE)).thenReturn(List.of());
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> {
            Connection c = i.getArgument(0);
            c.setCreatedAt(LocalDateTime.now());
            c.setUpdatedAt(LocalDateTime.now());
            return c;
        });

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());
        request.setType(ConnectionType.SOCIAL);

        ConnectionResponse response = connectionService.sendRequest(sender.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.PENDING);
    }

    @Test
    void shouldRejectSelfConnection() {
        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(sender.getId());

        assertThatThrownBy(() -> connectionService.sendRequest(sender.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("yourself");
    }

    @Test
    void shouldRejectDuplicateConnection() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        Connection existing = buildConnection(sender, target, ConnectionStatus.ACTIVE);
        when(connectionRepository.findBetweenUsers(sender.getId(), target.getId())).thenReturn(Optional.of(existing));

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());

        assertThatThrownBy(() -> connectionService.sendRequest(sender.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void shouldEnforceRateLimit() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(any(), any())).thenReturn(Optional.empty());
        when(connectionRepository.countRequestsSince(eq(sender.getId()), any(LocalDateTime.class))).thenReturn(10L);

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());

        assertThatThrownBy(() -> connectionService.sendRequest(sender.getId(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("limit");
    }

    @Test
    void shouldAcceptConnectionRequest() {
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(true);

        ConnectionResponse response = connectionService.respond(target.getId(), pending.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
    }

    @Test
    void respond_isRefusedAcrossABlock_soNoFriendshipTheBlockerNeverAgreedTo() {
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(blockService.isHidden(sender.getId(), target.getId())).thenReturn(true);
        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(true);

        assertThatThrownBy(() -> connectionService.respond(target.getId(), pending.getId(), request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(com.towinly.block.service.BlockService.NOT_AVAILABLE);
        verify(connectionRepository, never()).save(any(Connection.class));
    }

    @Test
    void acceptingFamilyRequestSkipsTheConnectionCap() {
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        pending.setType(ConnectionType.FAMILY);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));
        // Both sides sit over every role's cap — FAMILY coordination must still land,
        // matching sendRequest's exemption ("never eat into anyone's capacity").
        List<Connection> full = java.util.stream.IntStream.range(0, 25)
                .mapToObj(i -> buildConnection(sender, target, ConnectionStatus.ACTIVE))
                .toList();
        lenient().when(connectionRepository.findByUserAndStatus(any(), eq(ConnectionStatus.ACTIVE)))
                .thenReturn(full);

        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(true);

        ConnectionResponse response = connectionService.respond(target.getId(), pending.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
    }

    @Test
    void shouldDeclineConnectionRequest() {
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(false);

        ConnectionResponse response = connectionService.respond(target.getId(), pending.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.DECLINED);
    }

    @Test
    void shouldGetMyConnections() {
        Connection c = buildConnection(sender, target, ConnectionStatus.ACTIVE);
        when(connectionRepository.findAllByUser(eq(sender.getId()), any(Pageable.class))).thenReturn(List.of(c));

        List<ConnectionResponse> result = connectionService.getMyConnections(sender.getId(), null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getOtherUserId()).isEqualTo(target.getId());
    }

    @Test
    void getMyConnections_loadsPreviewsUnreadCountsAndProfilesInBatchQueries() {
        User second = buildUser(UUID.randomUUID(), "second@test.com");
        Connection withChat = buildConnection(sender, target, ConnectionStatus.ACTIVE);
        Connection quiet = buildConnection(sender, second, ConnectionStatus.ACTIVE);
        LocalDateTime lastAt = LocalDateTime.now().minusMinutes(3);

        when(connectionRepository.findAllByUser(eq(sender.getId()), any(Pageable.class)))
                .thenReturn(List.of(withChat, quiet));
        when(messageRepository.findLatestByConnectionIds(anyCollection(), eq(com.towinly.common.enums.MessageChannel.MAIN)))
                .thenReturn(List.<Object[]>of(new Object[]{withChat.getId(), "See you Tuesday", lastAt}));
        when(messageRepository.countUnreadByConnectionIds(anyCollection(), eq(sender.getId()), eq(com.towinly.common.enums.MessageChannel.MAIN)))
                .thenReturn(List.<Object[]>of(new Object[]{withChat.getId(), 3L}));
        when(elderProfileRepository.findProfileCardsByUserIds(anyCollection()))
                .thenReturn(List.<Object[]>of(new Object[]{target.getId(), "Margaret", "photos/m.jpg", 72}));
        when(helperProfileRepository.findProfileCardsByUserIds(anyCollection()))
                .thenReturn(List.<Object[]>of());
        when(s3Service.presignedUrl("photos/m.jpg")).thenReturn("https://signed/m.jpg");

        List<ConnectionResponse> result = connectionService.getMyConnections(sender.getId(), null);

        ConnectionResponse chatty = result.stream()
                .filter(r -> r.getId().equals(withChat.getId())).findFirst().orElseThrow();
        assertThat(chatty.getOtherUserName()).isEqualTo("Margaret");
        assertThat(chatty.getOtherUserAge()).isEqualTo(72);
        assertThat(chatty.getOtherUserPhotoUrl()).isEqualTo("https://signed/m.jpg");
        assertThat(chatty.getLastMessagePreview()).isEqualTo("See you Tuesday");
        assertThat(chatty.getLastMessageAt()).isEqualTo(lastAt);
        assertThat(chatty.getUnreadCount()).isEqualTo(3);

        ConnectionResponse silent = result.stream()
                .filter(r -> r.getId().equals(quiet.getId())).findFirst().orElseThrow();
        assertThat(silent.getLastMessagePreview()).isNull();
        assertThat(silent.getUnreadCount()).isZero();
        assertThat(silent.getOtherUserName())
                .as("no profile and no name: a connection card never shows their email")
                .isEqualTo("Someone");

        // One query per lookup for the whole list — never one per connection.
        // MAIN-scoped (US-006): family updates must never leak into previews or badges.
        verify(messageRepository, times(1)).findLatestByConnectionIds(anyCollection(), eq(com.towinly.common.enums.MessageChannel.MAIN));
        verify(messageRepository, times(1)).countUnreadByConnectionIds(anyCollection(), any(), eq(com.towinly.common.enums.MessageChannel.MAIN));
        verify(elderProfileRepository, times(1)).findProfileCardsByUserIds(anyCollection());
        verify(helperProfileRepository, times(1)).findProfileCardsByUserIds(anyCollection());
        verify(messageRepository, never()).findFirstByConnectionIdOrderByCreatedAtDesc(any());
        verify(messageRepository, never()).countByConnectionIdAndSenderIdNotAndSeenAtIsNull(any(), any());
        verify(elderProfileRepository, never()).findByUserId(any());
        verify(helperProfileRepository, never()).findByUserId(any());
    }

    @Test
    void getMyConnections_boundsTheListToADefaultPageSize() {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(connectionRepository.findAllByUser(eq(sender.getId()), pageable.capture())).thenReturn(List.of());

        connectionService.getMyConnections(sender.getId(), null);

        assertThat(pageable.getValue().getPageSize()).isEqualTo(ConnectionService.DEFAULT_PAGE_SIZE);
        verify(connectionRepository, never()).findAllByUser(any());
    }

    // HARD-106: a block hides each person from the other, in both directions,
    // at the source. The inbox never lists them and a request never reaches them.
    @Test
    void getMyConnections_hidesAnyoneBlockedInEitherDirection() {
        User second = buildUser(UUID.randomUUID(), "second@test.com");
        Connection withBlocked = buildConnection(sender, target, ConnectionStatus.ACTIVE);
        Connection clean = buildConnection(sender, second, ConnectionStatus.ACTIVE);
        when(connectionRepository.findAllByUser(eq(sender.getId()), any(Pageable.class)))
                .thenReturn(List.of(withBlocked, clean));
        when(blockService.hiddenFor(sender.getId())).thenReturn(java.util.Set.of(target.getId()));

        List<ConnectionResponse> result = connectionService.getMyConnections(sender.getId(), null);

        assertThat(result).extracting(ConnectionResponse::getOtherUserId).containsExactly(second.getId());
    }

    @Test
    void sendRequest_isRefusedWhenEitherPersonBlockedTheOther_withoutSayingWhy() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(blockService.isHidden(sender.getId(), target.getId())).thenReturn(true);
        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());
        request.setType(ConnectionType.SOCIAL);

        assertThatThrownBy(() -> connectionService.sendRequest(sender.getId(), request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(com.towinly.block.service.BlockService.NOT_AVAILABLE);
        verify(connectionRepository, never()).save(any(Connection.class));
    }

    // ------------------------------------------------------------------
    // SEC-02: a phone number opens on a friendship that is LIVE and has
    // climbed to Phone Ready. The rung alone is not enough. The score head
    // start in sendRequest stands a brand-new PENDING request at PHONE_CALL,
    // and a declined or ended friendship keeps whatever rung it died on.
    // ------------------------------------------------------------------

    @Test
    void sendRequest_keepsTheHeadStartRungButHandsOutNoPhoneOnAPendingRequest() {
        // The harvest: a helper with a decent score sends a request nobody has
        // answered, and reads the target's number straight out of the reply.
        sender.setTrustScore(60.0);
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(sender.getId(), target.getId())).thenReturn(Optional.empty());
        when(connectionRepository.countRequestsSince(eq(sender.getId()), any(LocalDateTime.class))).thenReturn(0L);
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(target.getId());
        request.setType(ConnectionType.SOCIAL);

        ConnectionResponse response = connectionService.sendRequest(sender.getId(), request);

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository).save(captor.capture());
        // The head start is a product feature and is left exactly as it was.
        assertThat(captor.getValue().getStatus()).isEqualTo(ConnectionStatus.PENDING);
        assertThat(captor.getValue().getCurrentTrustLevel()).isEqualTo(TrustLevel.PHONE_CALL);
        assertThat(response.getCurrentTrustLevel()).isEqualTo(TrustLevel.PHONE_CALL);
        assertThat(response.getOtherUserPhone())
                .as("nobody has answered this request, so the number stays private")
                .isNull();
    }

    @Test
    void respond_decliningARequest_paysTheSenderNoPhoneNumber() {
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        pending.setCurrentTrustLevel(TrustLevel.PHONE_CALL);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(false);

        ConnectionResponse response = connectionService.respond(target.getId(), pending.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.DECLINED);
        assertThat(response.getOtherUserPhone())
                .as("turning someone down must never pay you their number")
                .isNull();
    }

    @Test
    void respond_acceptingAtPhoneReady_doesHandOverTheNumber() {
        // The legitimate case, which must keep working: consent plus the rung.
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        pending.setCurrentTrustLevel(TrustLevel.PHONE_CALL);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(true);

        ConnectionResponse response = connectionService.respond(target.getId(), pending.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
        assertThat(response.getOtherUserPhone()).isEqualTo("+1234567890");
    }

    @Test
    void getMyConnections_hidesThePhoneOnAPendingConnection() {
        // The replay route: re-reading the inbox costs the attacker no new request.
        assertThat(inboxPhoneFor(ConnectionStatus.PENDING, TrustLevel.PHONE_CALL)).isNull();
    }

    @Test
    void getMyConnections_hidesThePhoneOnADeclinedConnection() {
        assertThat(inboxPhoneFor(ConnectionStatus.DECLINED, TrustLevel.VERIFIED)).isNull();
    }

    @Test
    void getMyConnections_hidesThePhoneOnAnEndedConnection() {
        // Ending a friendship takes the number back, which it never used to.
        assertThat(inboxPhoneFor(ConnectionStatus.ENDED, TrustLevel.TRUSTED)).isNull();
    }

    @Test
    void getMyConnections_hidesThePhoneOnAPausedConnection() {
        // Deliberate: a paused friendship stops reporting the number until it
        // resumes. No screen shows it today, and resuming brings it straight back.
        assertThat(inboxPhoneFor(ConnectionStatus.PAUSED, TrustLevel.TRUSTED)).isNull();
    }

    @Test
    void getMyConnections_showsThePhoneOnALiveConnectionAtPhoneReady() {
        assertThat(inboxPhoneFor(ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL)).isEqualTo("+1234567890");
    }

    @Test
    void getMyConnections_showsThePhoneOnALiveConnectionAbovePhoneReady() {
        assertThat(inboxPhoneFor(ConnectionStatus.ACTIVE, TrustLevel.TRUSTED)).isEqualTo("+1234567890");
    }

    @Test
    void getMyConnections_stillHidesThePhoneOnALiveConnectionBelowPhoneReady() {
        // The rung half of the rule, pinned so adding the status half cannot drop it.
        assertThat(inboxPhoneFor(ConnectionStatus.ACTIVE, TrustLevel.MESSAGING)).isNull();
    }

    @Test
    void setFamilyVisibility_handsOutNoPhoneOnAConnectionThatIsNotLive() {
        // The elder seat can toggle sharing on a row of any status and gets a full
        // response back, so this route needs the same gate as the inbox.
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        pending.setCurrentTrustLevel(TrustLevel.PHONE_CALL);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        ConnectionResponse response =
                connectionService.setFamilyVisibility(sender.getId(), pending.getId(), true);

        assertThat(response.getOtherUserPhone()).isNull();
    }

    /** The counterparty phone the inbox would show for a single connection in this state. */
    private String inboxPhoneFor(ConnectionStatus status, TrustLevel level) {
        Connection c = buildConnection(sender, target, status);
        c.setCurrentTrustLevel(level);
        when(connectionRepository.findAllByUser(eq(sender.getId()), any(Pageable.class))).thenReturn(List.of(c));
        return connectionService.getMyConnections(sender.getId(), null).get(0).getOtherUserPhone();
    }

    private User buildUser(UUID id, String email) {
        return User.builder()
                .id(id)
                .email(email)
                .phone("+1234567890")
                .passwordHash("hash")
                .role(UserRole.ELDER)
                .trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();
    }

    private Connection buildConnection(User userA, User userB, ConnectionStatus status) {
        return Connection.builder()
                .id(UUID.randomUUID())
                .userA(userA)
                .userB(userB)
                .type(ConnectionType.SOCIAL)
                .status(status)
                .initiatedBy(userA)
                .build();
    }
}
