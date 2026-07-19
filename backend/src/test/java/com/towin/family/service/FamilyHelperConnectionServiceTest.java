package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.connection.service.ConnectionService;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.repository.ElderProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Step 4 gate matrix: a family member may request a connection with a helper
 * ONLY through a parent's shared, FIRST_MEET-or-beyond friendship.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FamilyHelperConnectionServiceTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock ConnectionService connectionService;

    FamilyHelperConnectionService service;

    UUID callerId = UUID.randomUUID();
    User elder;
    User helper;
    Connection shared;
    UUID sharedId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new FamilyHelperConnectionService(
                connectionRepository, familyLinkRepository, elderProfileRepository, connectionService);
        elder  = User.builder().id(UUID.randomUUID()).build();
        helper = User.builder().id(UUID.randomUUID()).build();
        shared = Connection.builder()
                .id(sharedId).userA(elder).userB(helper)
                .status(ConnectionStatus.ACTIVE)
                .sharedWithFamily(true)
                .currentTrustLevel(TrustLevel.FIRST_MEET)
                .build();
        when(connectionRepository.findById(sharedId)).thenReturn(Optional.of(shared));
        when(elderProfileRepository.findByUserId(elder.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Margaret").build()));
    }

    private void linkStatus(FamilyLinkStatus status) {
        FamilyLink link = mock(FamilyLink.class);
        when(link.getStatus()).thenReturn(status);
        when(familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), callerId))
                .thenReturn(Optional.of(link));
    }

    @Test
    void linkedFamily_requestsFamilyTypedConnectionWithHelper() {
        linkStatus(FamilyLinkStatus.ACTIVE);

        service.requestHelperConnection(callerId, sharedId);

        ArgumentCaptor<ConnectionRequest> captor = ArgumentCaptor.forClass(ConnectionRequest.class);
        verify(connectionService).sendRequest(org.mockito.ArgumentMatchers.eq(callerId), captor.capture());
        assertThat(captor.getValue().getTargetUserId()).isEqualTo(helper.getId());
        assertThat(captor.getValue().getType()).isEqualTo(ConnectionType.FAMILY);
        assertThat(captor.getValue().getRequestMessage()).isEqualTo("Family of Margaret");
    }

    @Test
    void notLinked_isDenied() {
        assertThatThrownBy(() -> service.requestHelperConnection(callerId, sharedId))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(connectionService);
    }

    @Test
    void revokedLink_isDenied() {
        linkStatus(FamilyLinkStatus.REVOKED);
        assertThatThrownBy(() -> service.requestHelperConnection(callerId, sharedId))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(connectionService);
    }

    @Test
    void unsharedConnection_isDenied() {
        shared.setSharedWithFamily(false);
        linkStatus(FamilyLinkStatus.ACTIVE);
        assertThatThrownBy(() -> service.requestHelperConnection(callerId, sharedId))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(connectionService);
    }

    @Test
    void belowFirstMeet_isDenied() {
        shared.setCurrentTrustLevel(TrustLevel.VIDEO_CALL);
        linkStatus(FamilyLinkStatus.ACTIVE);
        assertThatThrownBy(() -> service.requestHelperConnection(callerId, sharedId))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(connectionService);
    }

    @Test
    void anyStatusButActive_isDenied() {
        shared.setStatus(ConnectionStatus.PAUSED);
        linkStatus(FamilyLinkStatus.ACTIVE);
        assertThatThrownBy(() -> service.requestHelperConnection(callerId, sharedId))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(connectionService);
    }
}
