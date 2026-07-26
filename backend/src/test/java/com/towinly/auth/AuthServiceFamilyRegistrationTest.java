package com.towinly.auth;

import com.towinly.auth.dto.RegisterRequest;
import com.towinly.auth.security.PasswordPolicy;
import com.towinly.auth.service.AuthService;
import com.towinly.common.entity.PendingRegistration;
import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.PendingRegistrationRepository;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.EmailService;
import com.towinly.common.service.PostHogService;
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
