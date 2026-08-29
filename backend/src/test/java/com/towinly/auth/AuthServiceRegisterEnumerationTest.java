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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * SEC-08: signing up must not confirm whether a person is already a member.
 *
 * <p>Towinly's members are elderly, and membership implies living alone and letting
 * strangers in, so "is this address registered?" is a targeting question. Login and
 * forgot-password already answer it the same way for everybody; registration is held
 * to the same standard here.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceRegisterEnumerationTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock PasswordPolicy passwordPolicy;
    @Mock EmailService emailService;
    @Mock PendingRegistrationRepository pendingRepository;
    @Mock PostHogService postHogService;
    @InjectMocks AuthService authService;

    private static final String KNOWN = "already@example.com";
    private static final String FRESH = "newcomer@example.com";

    private RegisterRequest request(String email) {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("newcomer");
        req.setEmail(email);
        req.setPassword("longenoughpw");
        req.setRole(UserRole.ELDER);
        return req;
    }

    private User member() {
        User user = User.builder().username("theowner").email(KNOWN).role(UserRole.ELDER).build();
        user.setId(UUID.randomUUID());
        return user;
    }

    @Test
    void register_answersAKnownEmailExactlyAsItAnswersANewOne() {
        when(userRepository.existsByEmail(FRESH)).thenReturn(false);
        when(userRepository.existsByEmail(KNOWN)).thenReturn(true);
        when(userRepository.findByEmail(KNOWN)).thenReturn(Optional.of(member()));

        assertThatCode(() -> authService.register(request(FRESH))).doesNotThrowAnyException();
        assertThatCode(() -> authService.register(request(KNOWN))).doesNotThrowAnyException();
    }

    @Test
    void register_neverTellsTheCallerThatAnAddressBelongsToAMember() {
        when(userRepository.existsByEmail(KNOWN)).thenReturn(true);
        when(userRepository.findByEmail(KNOWN)).thenReturn(Optional.of(member()));

        assertThatCode(() -> authService.register(request(KNOWN))).doesNotThrowAnyException();

        // Nothing is staged for a duplicate, and the caller is not sent a link they
        // could use to finish taking over an address that is not theirs.
        verify(pendingRepository, never()).save(any(PendingRegistration.class));
        verify(emailService, never()).sendVerificationEmail(anyString(), anyString());
    }

    @Test
    void register_tellsTheRealOwnerThroughTheirOwnInbox() {
        // The person who forgot they already have an account must still learn it, and
        // the only safe place to say so is the mailbox that already exists.
        User owner = member();
        when(userRepository.existsByEmail(KNOWN)).thenReturn(true);
        when(userRepository.findByEmail(KNOWN)).thenReturn(Optional.of(owner));

        authService.register(request(KNOWN));

        verify(emailService).sendPasswordResetEmail(eq(KNOWN), anyString());
        assertThat(owner.getPasswordResetToken()).isNotBlank();
        verify(userRepository).save(owner);
    }

    @Test
    void register_doesTheSameSlowWorkForAKnownEmailAsForANewOne() {
        // Hashing is by far the slowest step. If it only ran for new addresses, a
        // stopwatch would answer the question the response refuses to, so it runs
        // on both paths and each path sends exactly one email.
        when(userRepository.existsByEmail(KNOWN)).thenReturn(true);
        when(userRepository.findByEmail(KNOWN)).thenReturn(Optional.of(member()));

        authService.register(request(KNOWN));

        verify(passwordEncoder).encode("longenoughpw");
        verify(emailService, times(1)).sendPasswordResetEmail(anyString(), anyString());
    }

    @Test
    void register_neverAsksWhetherAUsernameIsTaken() {
        // Same probe by another door: a handle names a person too. The check that
        // matters happens when the emailed link is opened, by which point the answer
        // goes to whoever is holding that mailbox.
        when(userRepository.existsByEmail(FRESH)).thenReturn(false);

        assertThatCode(() -> authService.register(request(FRESH))).doesNotThrowAnyException();

        verify(userRepository, never()).existsByUsername(anyString());
        verify(pendingRepository).save(any(PendingRegistration.class));
        verify(emailService).sendVerificationEmail(eq(FRESH), anyString());
    }

    @Test
    void register_checksThePasswordBeforeItLooksTheAddressUp() {
        // A weak password answered before the duplicate check would rebuild the oracle:
        // "stronger password please" would mean new, silence would mean member.
        doThrow(new IllegalArgumentException("Password must be at least 8 characters"))
                .when(passwordPolicy).validate(anyString(), anyString(), anyString());

        assertThatThrownBy(() -> authService.register(request(KNOWN)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Password must be at least 8 characters");

        verify(userRepository, never()).existsByEmail(anyString());
        verify(userRepository, never()).findByEmail(anyString());
    }
}
