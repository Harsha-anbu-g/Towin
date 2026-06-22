package com.towin.auth;

import com.towin.auth.service.AuthService;
import com.towin.common.entity.PendingRegistration;
import com.towin.common.entity.User;
import com.towin.common.repository.PendingRegistrationRepository;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.PostHogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceVerifyEmailTest {

    @Mock UserRepository userRepository;
    @Mock PendingRegistrationRepository pendingRepository;
    @Mock PostHogService postHogService;
    @InjectMocks AuthService authService;

    private PendingRegistration pending(String token, LocalDateTime expiry) {
        return PendingRegistration.builder()
                .id(UUID.randomUUID())
                .username("alice").email("alice@example.com")
                .passwordHash("hash").role("ELDER")
                .token(token).expiresAt(expiry).build();
    }

    @Test
    void verifyEmail_createsUserAndDeletesPending() {
        PendingRegistration p = pending("abc", LocalDateTime.now().plusHours(1));
        when(pendingRepository.findByToken("abc")).thenReturn(Optional.of(p));
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        authService.verifyEmail("abc");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().isEmailVerified()).isTrue();
        assertThat(captor.getValue().getEmail()).isEqualTo("alice@example.com");
        verify(pendingRepository).delete(p);
    }

    @Test
    void verifyEmail_rejectsUnknownToken() {
        when(pendingRepository.findByToken("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyEmail("nope"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void verifyEmail_rejectsExpiredToken() {
        PendingRegistration p = pending("old", LocalDateTime.now().minusMinutes(1));
        when(pendingRepository.findByToken("old")).thenReturn(Optional.of(p));

        assertThatThrownBy(() -> authService.verifyEmail("old"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRepository, never()).save(any());
    }
}
