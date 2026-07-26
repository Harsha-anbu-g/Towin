package com.towinly.auth.service;

import com.towinly.auth.dto.LoginRequest;
import com.towinly.auth.dto.RegisterRequest;
import com.towinly.auth.security.JwtUtil;
import com.towinly.auth.security.LoginRateLimiter;
import com.towinly.auth.security.PasswordPolicy;
import com.towinly.common.entity.PendingRegistration;
import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.PendingRegistrationRepository;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.EmailService;
import com.towinly.common.service.PostHogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtUtil jwtUtil;
    @Mock LoginRateLimiter loginRateLimiter;
    @Mock PostHogService postHogService;
    @Mock EmailService emailService;
    @Mock PendingRegistrationRepository pendingRepository;
    @Mock PasswordPolicy passwordPolicy;
    @InjectMocks AuthService authService;

    @Test
    void shouldThrowWhenUsernameAlreadyExists() {
        RegisterRequest req = registerRequest();
        when(userRepository.existsByUsername("testuser")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Username already taken");
    }

    @Test
    void shouldRegisterSuccessfully() {
        RegisterRequest req = registerRequest();

        // Registration no longer creates an account or returns a token — it holds the
        // signup in pending_registrations and emails a verification link. The account
        // is only created when the user clicks that link.
        authService.register(req);

        verify(pendingRepository).save(any(PendingRegistration.class));
        verify(emailService).sendVerificationEmail(any(), anyString());
    }

    @Test
    void shouldThrowOnInvalidLoginEmail() {
        LoginRequest req = new LoginRequest();
        req.setIdentifier("test@email.com");
        req.setPassword("wrongpassword");

        when(userRepository.findByEmail("test@email.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid credentials");
    }

    @Test
    void shouldThrowOnWrongPassword() {
        LoginRequest req = new LoginRequest();
        req.setIdentifier("test@email.com");
        req.setPassword("wrongpassword");

        UUID userId = UUID.randomUUID();
        User user = User.builder().email("test@email.com").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);

        when(userRepository.findByEmail("test@email.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongpassword", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid credentials");
    }

    @Test
    void shouldLoginByPhoneEvenWhenNotVerified() {
        // A brand-new account hasn't done the SMS OTP yet (phoneVerified = false).
        // The password proves identity, so phone login must still work.
        LoginRequest req = new LoginRequest();
        req.setIdentifier("+14165550123");
        req.setPassword("password123");

        UUID userId = UUID.randomUUID();
        User user = User.builder().phone("+14165550123").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);
        user.setPhoneVerified(false);

        when(userRepository.findByPhone("+14165550123")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashed")).thenReturn(true);
        when(jwtUtil.generateToken(userId.toString(), null, "ELDER", 0)).thenReturn("mock-token");

        var response = authService.login(req);

        assertThat(response.getToken()).isEqualTo("mock-token");
        assertThat(response.getRole()).isEqualTo("ELDER");
    }

    @Test
    void shouldMatchPhoneTypedWithSpacesAndDashes() {
        // Stored as "+14165550123" at registration; user types it with separators.
        LoginRequest req = new LoginRequest();
        req.setIdentifier("+1 416-555 0123");
        req.setPassword("password123");

        UUID userId = UUID.randomUUID();
        User user = User.builder().phone("+14165550123").passwordHash("hashed").role(UserRole.ELDER).build();
        user.setId(userId);

        when(userRepository.findByPhone("+14165550123")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "hashed")).thenReturn(true);
        when(jwtUtil.generateToken(userId.toString(), null, "ELDER", 0)).thenReturn("mock-token");

        var response = authService.login(req);

        assertThat(response.getToken()).isEqualTo("mock-token");
    }

    @Test
    void shouldSetFirstPasswordOnGoogleOnlyAccount() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().email("g@email.com").passwordHash(null).role(UserRole.HELPER).build();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("newpassword1")).thenReturn("hashed-new");

        authService.setPassword(userId, "newpassword1");

        assertThat(user.getPasswordHash()).isEqualTo("hashed-new");
        verify(userRepository).save(user);
    }

    @Test
    void shouldRefuseSetPasswordWhenOneAlreadyExists() {
        // Replacing an existing password must go through change-password,
        // which verifies the current one first.
        UUID userId = UUID.randomUUID();
        User user = User.builder().email("g@email.com").passwordHash("existing").role(UserRole.HELPER).build();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.setPassword(userId, "newpassword1"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already has a password");
        verify(userRepository, never()).save(any());
    }

    private RegisterRequest registerRequest() {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("testuser");
        req.setPassword("password123");
        req.setRole(UserRole.ELDER);
        return req;
    }
}
