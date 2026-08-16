package com.towinly.notification.controller;

import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.notification.dto.PushTokenRequest;
import com.towinly.notification.entity.PushToken;
import com.towinly.notification.repository.PushTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PushTokenControllerTest {

    @Mock PushTokenRepository pushTokenRepository;
    @Mock UserRepository userRepository;
    @Mock Authentication auth;

    PushTokenController controller;

    UUID callerId;
    User caller;

    @BeforeEach
    void setUp() {
        controller = new PushTokenController(pushTokenRepository, userRepository);
        callerId = UUID.randomUUID();
        caller = User.builder().id(callerId).build();
    }

    private PushTokenRequest request(String token) {
        return PushTokenRequest.builder().token(token).platform("ios").build();
    }

    @Test
    void aValueThatIsNotAnExpoTokenIsRefusedBeforeItCanSitInTheTable() {
        // No auth stub on purpose: the shape check answers before who-is-asking is read.
        ResponseEntity<Void> response = controller.register(request("not-a-push-token"), auth);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        verify(pushTokenRepository, never()).save(any());
    }

    @Test
    void aNewTokenIsSavedForTheSignedInCaller() {
        when(auth.getName()).thenReturn(callerId.toString());
        when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
        when(pushTokenRepository.findByToken("ExponentPushToken[abc]")).thenReturn(Optional.empty());

        ResponseEntity<Void> response = controller.register(request("ExponentPushToken[abc]"), auth);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        ArgumentCaptor<PushToken> saved = ArgumentCaptor.forClass(PushToken.class);
        verify(pushTokenRepository).save(saved.capture());
        assertThat(saved.getValue().getUser().getId()).isEqualTo(callerId);
        assertThat(saved.getValue().getToken()).isEqualTo("ExponentPushToken[abc]");
    }

    @Test
    void aDeviceThatSignsIntoASecondAccountFollowsTheNewUser() {
        UUID previousOwner = UUID.randomUUID();
        PushToken existing = PushToken.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(previousOwner).build())
                .token("ExponentPushToken[abc]")
                .platform("ios")
                .updatedAt(LocalDateTime.now().minusDays(3))
                .build();
        when(auth.getName()).thenReturn(callerId.toString());
        when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
        when(pushTokenRepository.findByToken("ExponentPushToken[abc]")).thenReturn(Optional.of(existing));

        controller.register(request("ExponentPushToken[abc]"), auth);

        // Same row, new owner — the old account must never keep ringing this phone.
        verify(pushTokenRepository).save(existing);
        assertThat(existing.getUser().getId()).isEqualTo(callerId);
    }

    @Test
    void holdingTheExactTokenIsEnoughToSilenceTheDevice() {
        // Deliberately no Authentication: a phone whose session expired must
        // still be able to stop ringing for the account that left. The token
        // is unguessable, so possession is the authorization.
        PushToken row = PushToken.builder()
                .id(UUID.randomUUID())
                .user(User.builder().id(UUID.randomUUID()).build())
                .token("ExponentPushToken[abc]")
                .platform("ios")
                .updatedAt(LocalDateTime.now())
                .build();
        when(pushTokenRepository.findByToken("ExponentPushToken[abc]")).thenReturn(Optional.of(row));

        ResponseEntity<Void> response = controller.unregister(request("ExponentPushToken[abc]"));

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(pushTokenRepository).delete(row);
    }

    @Test
    void silencingAnUnknownTokenSaysNothingAboutWhatExists() {
        when(pushTokenRepository.findByToken("ExponentPushToken[gone]")).thenReturn(Optional.empty());

        ResponseEntity<Void> response = controller.unregister(request("ExponentPushToken[gone]"));

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(pushTokenRepository, never()).delete(any());
    }

    @Test
    void theEleventhDeviceEvictsTheStalestRowNotTheTable() {
        when(auth.getName()).thenReturn(callerId.toString());
        when(userRepository.findById(callerId)).thenReturn(Optional.of(caller));
        when(pushTokenRepository.findByToken("ExponentPushToken[new]")).thenReturn(Optional.empty());
        java.util.List<PushToken> ten = new java.util.ArrayList<>();
        for (int i = 0; i < PushTokenController.MAX_TOKENS_PER_USER; i++) {
            ten.add(PushToken.builder()
                    .id(UUID.randomUUID())
                    .user(caller)
                    .token("ExponentPushToken[t" + i + "]")
                    .platform("ios")
                    .updatedAt(LocalDateTime.now().minusDays(i))
                    .build());
        }
        when(pushTokenRepository.findAllByUserId(callerId)).thenReturn(ten);

        controller.register(request("ExponentPushToken[new]"), auth);

        // The oldest row leaves; the fresh device is saved; nothing else goes.
        verify(pushTokenRepository).delete(ten.get(PushTokenController.MAX_TOKENS_PER_USER - 1));
        verify(pushTokenRepository).save(any(PushToken.class));
    }
}
