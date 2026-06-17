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
    ConnectionService connectionService;

    private User sender;
    private User target;

    @BeforeEach
    void setUp() {
        // Manual construction: the service takes Optional<ConnectionEventProducer>,
        // which @InjectMocks cannot populate
        connectionService = new ConnectionService(
                connectionRepository, userRepository, elderProfileRepository,
                helperProfileRepository, Optional.empty(), messageRepository, trustScoreService);
        sender = buildUser(UUID.randomUUID(), "sender@test.com");
        target = buildUser(UUID.randomUUID(), "target@test.com");
    }

    @Test
    void shouldSendConnectionRequest() {
        when(userRepository.findById(sender.getId())).thenReturn(Optional.of(sender));
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(sender.getId(), target.getId())).thenReturn(Optional.empty());
        when(connectionRepository.countRequestsSince(eq(sender.getId()), any(LocalDateTime.class))).thenReturn(0L);
        when(elderProfileRepository.findByUserId(target.getId())).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(target.getId())).thenReturn(Optional.empty());
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
        when(elderProfileRepository.findByUserId(sender.getId())).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(sender.getId())).thenReturn(Optional.empty());
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(true);

        ConnectionResponse response = connectionService.respond(target.getId(), pending.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
    }

    @Test
    void shouldDeclineConnectionRequest() {
        Connection pending = buildConnection(sender, target, ConnectionStatus.PENDING);
        when(connectionRepository.findById(pending.getId())).thenReturn(Optional.of(pending));
        when(elderProfileRepository.findByUserId(sender.getId())).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(sender.getId())).thenReturn(Optional.empty());
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        RespondToConnectionRequest request = new RespondToConnectionRequest();
        request.setAccept(false);

        ConnectionResponse response = connectionService.respond(target.getId(), pending.getId(), request);

        assertThat(response.getStatus()).isEqualTo(ConnectionStatus.DECLINED);
    }

    @Test
    void shouldGetMyConnections() {
        Connection c = buildConnection(sender, target, ConnectionStatus.ACTIVE);
        when(connectionRepository.findAllByUser(sender.getId())).thenReturn(List.of(c));
        when(elderProfileRepository.findByUserId(target.getId())).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(target.getId())).thenReturn(Optional.empty());

        List<ConnectionResponse> result = connectionService.getMyConnections(sender.getId(), null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getOtherUserId()).isEqualTo(target.getId());
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
