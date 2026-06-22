package com.towin.auth;

import com.towin.auth.service.AuthService;
import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
    @InjectMocks AuthService authService;

    private User userWithToken(String token, LocalDateTime expiry) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setEmailVerified(false);
        u.setEmailVerificationToken(token);
        u.setEmailVerificationExpiresAt(expiry);
        return u;
    }

    @Test
    void verifyEmail_marksVerifiedAndClearsToken() {
        User u = userWithToken("abc", LocalDateTime.now().plusHours(1));
        when(userRepository.findByEmailVerificationToken("abc")).thenReturn(Optional.of(u));

        authService.verifyEmail("abc");

        assertThat(u.isEmailVerified()).isTrue();
        assertThat(u.getEmailVerificationToken()).isNull();
        verify(userRepository).save(u);
    }

    @Test
    void verifyEmail_rejectsUnknownToken() {
        when(userRepository.findByEmailVerificationToken("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyEmail("nope"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void verifyEmail_rejectsExpiredToken() {
        User u = userWithToken("old", LocalDateTime.now().minusMinutes(1));
        when(userRepository.findByEmailVerificationToken("old")).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> authService.verifyEmail("old"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(u.isEmailVerified()).isFalse();
    }
}
