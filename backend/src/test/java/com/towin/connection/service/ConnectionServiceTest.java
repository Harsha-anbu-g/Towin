package com.towin.connection.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.dto.ConnectionResponse;
import com.towin.connection.dto.RespondToConnectionRequest;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
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
    @Mock com.towin.messaging.repository.MessageRepository messageRepository;
    @Mock com.towin.common.service.TrustScoreService trustScoreService;
    @Mock com.towin.common.service.S3Service s3Service;
    @Mock com.towin.family.repository.FamilyLinkRepository familyLinkRepository;
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
                familyLinkRepository);
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
        com.towin.family.entity.FamilyLink link = mock(com.towin.family.entity.FamilyLink.class);
        when(link.getStatus()).thenReturn(com.towin.common.enums.FamilyLinkStatus.ACTIVE);
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
                .isEqualTo(com.towin.common.enums.TrustLevel.DISCOVERED);
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
        when(messageRepository.findLatestByConnectionIds(anyCollection(), eq(com.towin.common.enums.MessageChannel.MAIN)))
                .thenReturn(List.<Object[]>of(new Object[]{withChat.getId(), "See you Tuesday", lastAt}));
        when(messageRepository.countUnreadByConnectionIds(anyCollection(), eq(sender.getId()), eq(com.towin.common.enums.MessageChannel.MAIN)))
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
        assertThat(silent.getOtherUserName()).isEqualTo(second.getEmail());

        // One query per lookup for the whole list — never one per connection.
        // MAIN-scoped (US-006): family updates must never leak into previews or badges.
        verify(messageRepository, times(1)).findLatestByConnectionIds(anyCollection(), eq(com.towin.common.enums.MessageChannel.MAIN));
        verify(messageRepository, times(1)).countUnreadByConnectionIds(anyCollection(), any(), eq(com.towin.common.enums.MessageChannel.MAIN));
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
