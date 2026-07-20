package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.trust.dto.TrustStatusResponse;
import com.towin.trust.entity.TrustProgressionLog;
import com.towin.emergency.service.SosService;
import com.towin.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrustServiceTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock TrustProgressionLogRepository trustLogRepository;
    @Mock UserRepository userRepository;
    @Mock SosService sosService;
    @Mock TrustScoreService trustScoreService;
    @Mock com.towin.family.service.FamilyDelegationService familyDelegationService;
    @InjectMocks TrustService trustService;

    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        userA = buildUser(UUID.randomUUID(), UserRole.ELDER);
        userB = buildUser(UUID.randomUUID(), UserRole.HELPER);
    }

    @Test
    void shouldAdvanceTrustLevelWhenBothConfirm() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED);
        connection.setConfirmedByUser(userA.getId(), true);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(userRepository.findById(userB.getId())).thenReturn(Optional.of(userB));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId())).thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TrustStatusResponse response = trustService.confirmTrustLevel(userB.getId(), connection.getId(), null);

        assertThat(response.getCurrentLevel()).isEqualTo(TrustLevel.MESSAGING);
    }

    @Test
    void shouldNotAdvanceWhenOnlyOneConfirms() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(userRepository.findById(userA.getId())).thenReturn(Optional.of(userA));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId())).thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TrustStatusResponse response = trustService.confirmTrustLevel(userA.getId(), connection.getId(), null);

        assertThat(response.getCurrentLevel()).isEqualTo(TrustLevel.DISCOVERED);
        assertThat(response.isConfirmedByMe()).isTrue();
    }

    @Test
    void shouldRejectHelperStartingAStep() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(userRepository.findById(userB.getId())).thenReturn(Optional.of(userB));

        assertThatThrownBy(() -> trustService.confirmTrustLevel(userB.getId(), connection.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("elder");

        assertThat(connection.isConfirmedByUser(userB.getId())).isFalse();
    }

    @Test
    void shouldLetBothRoleUserStartAStep() {
        User bothRoleUser = buildUser(UUID.randomUUID(), UserRole.BOTH);
        Connection connection = buildConnection(bothRoleUser, userB, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(userRepository.findById(bothRoleUser.getId())).thenReturn(Optional.of(bothRoleUser));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId())).thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        TrustStatusResponse response = trustService.confirmTrustLevel(bothRoleUser.getId(), connection.getId(), null);

        assertThat(response.isConfirmedByMe()).isTrue();
        assertThat(response.getCurrentLevel()).isEqualTo(TrustLevel.DISCOVERED);
    }

    @Test
    void helperCanAdvanceOnlyAfterElderStarts() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId())).thenReturn(List.of());

        assertThat(trustService.getStatus(userB.getId(), connection.getId()).isCanAdvance()).isFalse();
        assertThat(trustService.getStatus(userA.getId(), connection.getId()).isCanAdvance()).isTrue();

        connection.setConfirmedByUser(userA.getId(), true);

        assertThat(trustService.getStatus(userB.getId(), connection.getId()).isCanAdvance()).isTrue();
        assertThat(trustService.getStatus(userA.getId(), connection.getId()).isCanAdvance()).isFalse();
    }

    @Test
    void shouldRejectDoubleConfirmation() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED);
        connection.setConfirmedByUser(userA.getId(), true);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));

        assertThatThrownBy(() -> trustService.confirmTrustLevel(userA.getId(), connection.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already confirmed");
    }

    @Test
    void shouldPauseActiveConnection() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.ACTIVE, TrustLevel.MESSAGING);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(userRepository.findById(userA.getId())).thenReturn(Optional.of(userA));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId())).thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        trustService.pauseProgression(userA.getId(), connection.getId());

        assertThat(connection.getStatus()).isEqualTo(ConnectionStatus.PAUSED);
    }

    @Test
    void shouldResumeAPausedConnection() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.PAUSED, TrustLevel.MESSAGING);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId())).thenReturn(List.of());
        when(connectionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        trustService.resumeProgression(userA.getId(), connection.getId());

        assertThat(connection.getStatus()).isEqualTo(ConnectionStatus.ACTIVE);
    }

    @Test
    void shouldGetTrustStatus() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.ACTIVE, TrustLevel.PHONE_CALL);
        TrustProgressionLog log = TrustProgressionLog.builder()
                .id(UUID.randomUUID())
                .connection(connection)
                .fromLevel(TrustLevel.MESSAGING)
                .toLevel(TrustLevel.PHONE_CALL)
                .confirmedBy(userA)
                .build();

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));
        when(trustLogRepository.findByConnectionIdOrderByCreatedAtDesc(connection.getId())).thenReturn(List.of(log));

        TrustStatusResponse response = trustService.getStatus(userA.getId(), connection.getId());

        assertThat(response.getCurrentLevel()).isEqualTo(TrustLevel.PHONE_CALL);
        assertThat(response.getHistory()).hasSize(1);
    }

    @Test
    void shouldRejectConfirmOnNonActiveConnection() {
        Connection connection = buildConnection(userA, userB, ConnectionStatus.PAUSED, TrustLevel.MESSAGING);

        when(connectionRepository.findById(connection.getId())).thenReturn(Optional.of(connection));

        assertThatThrownBy(() -> trustService.confirmTrustLevel(userA.getId(), connection.getId(), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not active");
    }

    private User buildUser(UUID id, UserRole role) {
        return User.builder()
                .id(id)
                .email(id + "@test.com")
                .phone("+1234567890")
                .passwordHash("hash")
                .role(role)
                .trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();
    }

    private Connection buildConnection(User userA, User userB, ConnectionStatus status, TrustLevel level) {
        return Connection.builder()
                .id(UUID.randomUUID())
                .userA(userA)
                .userB(userB)
                .type(ConnectionType.SOCIAL)
                .status(status)
                .initiatedBy(userA)
                .currentTrustLevel(level)
                .build();
    }
}
