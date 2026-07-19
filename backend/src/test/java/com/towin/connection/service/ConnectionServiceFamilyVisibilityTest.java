package com.towin.connection.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.exception.ForbiddenException;
import com.towin.common.repository.UserRepository;
import com.towin.connection.dto.ConnectionResponse;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * US-006: POST /api/connections/{id}/family-visibility — only the elder
 * participant of a connection may choose whether their family sees it.
 */
@ExtendWith(MockitoExtension.class)
class ConnectionServiceFamilyVisibilityTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock com.towin.messaging.repository.MessageRepository messageRepository;
    @Mock com.towin.common.service.TrustScoreService trustScoreService;
    @Mock com.towin.common.service.S3Service s3Service;
    @Mock com.towin.family.repository.FamilyLinkRepository familyLinkRepository;
    ConnectionService connectionService;

    private User elder;
    private User helper;
    private Connection connection;

    @BeforeEach
    void setUp() {
        connectionService = new ConnectionService(
                connectionRepository, userRepository, elderProfileRepository,
                helperProfileRepository, Optional.empty(), messageRepository, trustScoreService, s3Service,
                familyLinkRepository);
        elder = buildUser(UUID.randomUUID(), "elder@test.com", UserRole.ELDER);
        helper = buildUser(UUID.randomUUID(), "helper@test.com", UserRole.HELPER);
        connection = buildConnection(elder, helper, ConnectionStatus.ACTIVE);
    }

    @Test
    void elderParticipantCanShareConnectionWithFamily() {
        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        ConnectionResponse response =
                connectionService.setFamilyVisibility(elder.getId(), connection.getId(), true);

        assertThat(response.isSharedWithFamily()).isTrue();
        assertThat(connection.getSharedWithFamily()).isTrue();
        verify(connectionRepository).save(connection);
    }

    @Test
    void elderParticipantCanMakeConnectionPrivateAgain() {
        connection.setSharedWithFamily(true);
        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        ConnectionResponse response =
                connectionService.setFamilyVisibility(elder.getId(), connection.getId(), false);

        assertThat(response.isSharedWithFamily()).isFalse();
        assertThat(connection.getSharedWithFamily()).isFalse();
    }

    @Test
    void bothRoleParticipantCountsAsElder() {
        User bothUser = buildUser(UUID.randomUUID(), "both@test.com", UserRole.BOTH);
        Connection c = buildConnection(bothUser, helper, ConnectionStatus.ACTIVE);
        when(connectionRepository.findById(c.getId())).thenReturn(Optional.of(c));
        when(connectionRepository.save(any(Connection.class))).thenAnswer(i -> i.getArgument(0));

        ConnectionResponse response =
                connectionService.setFamilyVisibility(bothUser.getId(), c.getId(), true);

        assertThat(response.isSharedWithFamily()).isTrue();
    }

    @Test
    void helperParticipantIsForbidden() {
        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));

        assertThatThrownBy(() ->
                connectionService.setFamilyVisibility(helper.getId(), connection.getId(), true))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Only the elder");

        assertThat(connection.getSharedWithFamily()).isFalse();
        verify(connectionRepository, never()).save(any());
    }

    @Test
    void nonParticipantIsRejected() {
        User stranger = buildUser(UUID.randomUUID(), "stranger@test.com", UserRole.ELDER);
        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));

        assertThatThrownBy(() ->
                connectionService.setFamilyVisibility(stranger.getId(), connection.getId(), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not part of this connection");

        verify(connectionRepository, never()).save(any());
    }

    @Test
    void unknownConnectionIsNotFound() {
        UUID missing = UUID.randomUUID();
        when(connectionRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                connectionService.setFamilyVisibility(elder.getId(), missing, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void connectionListResponsesDefaultToNotSharedWithFamily() {
        when(connectionRepository.findAllByUser(eq(elder.getId()), any(Pageable.class)))
                .thenReturn(List.of(connection));

        List<ConnectionResponse> result = connectionService.getMyConnections(elder.getId(), null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).isSharedWithFamily()).isFalse();
    }

    @Test
    void connectionListResponsesIncludeSharedFlagWhenOn() {
        connection.setSharedWithFamily(true);
        when(connectionRepository.findAllByUser(eq(elder.getId()), any(Pageable.class)))
                .thenReturn(List.of(connection));

        List<ConnectionResponse> result = connectionService.getMyConnections(elder.getId(), null);

        assertThat(result.get(0).isSharedWithFamily()).isTrue();
    }

    private User buildUser(UUID id, String email, UserRole role) {
        return User.builder()
                .id(id)
                .email(email)
                .phone("+1234567890")
                .passwordHash("hash")
                .role(role)
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
