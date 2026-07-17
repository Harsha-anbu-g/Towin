package com.towin.auth;

import com.towin.auth.dto.RegisterRequest;
import com.towin.auth.security.PasswordPolicy;
import com.towin.auth.service.AuthService;
import com.towin.common.entity.PendingRegistration;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.PendingRegistrationRepository;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.EmailService;
import com.towin.common.service.PostHogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** US-003: FAMILY is a public signup role, through the same pending-registration flow. */
@ExtendWith(MockitoExtension.class)
class AuthServiceFamilyRegistrationTest {

    @Mock UserRepository userRepository;
    @Mock PendingRegistrationRepository pendingRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock PasswordPolicy passwordPolicy;
    @Mock EmailService emailService;
    @Mock PostHogService postHogService;
    @InjectMocks AuthService authService;

    private RegisterRequest request(UserRole role) {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("sarah_daughter");
        req.setEmail("sarah@example.com");
        req.setPassword("longenoughpw");
        req.setRole(role);
        return req;
    }

    @Test
    void register_acceptsFamilyRole() {
        when(userRepository.existsByUsername("sarah_daughter")).thenReturn(false);
        when(userRepository.existsByEmail("sarah@example.com")).thenReturn(false);
        when(passwordEncoder.encode("longenoughpw")).thenReturn("hashed");

        authService.register(request(UserRole.FAMILY));

        ArgumentCaptor<PendingRegistration> captor = ArgumentCaptor.forClass(PendingRegistration.class);
        verify(pendingRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo("FAMILY");
        verify(emailService).sendVerificationEmail(eq("sarah@example.com"), anyString());
    }

    @Test
    void register_stillRejectsAdminRole() {
        assertThatThrownBy(() -> authService.register(request(UserRole.ADMIN)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(pendingRepository, never()).save(any());
    }

    @Test
    void verifyEmail_createsUserWithFamilyRole() {
        PendingRegistration pending = PendingRegistration.builder()
                .id(UUID.randomUUID())
                .username("sarah_daughter").email("sarah@example.com")
                .passwordHash("hashed").role("FAMILY")
                .token("tok").expiresAt(LocalDateTime.now().plusHours(1))
                .build();
        when(pendingRepository.findByToken("tok")).thenReturn(Optional.of(pending));
        when(userRepository.existsByEmail("sarah@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("sarah_daughter")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        authService.verifyEmail("tok");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(UserRole.FAMILY);
        assertThat(captor.getValue().isEmailVerified()).isTrue();
    }
}
