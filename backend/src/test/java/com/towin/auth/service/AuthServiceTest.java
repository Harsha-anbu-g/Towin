package com.towin.auth.service;

import com.towin.auth.dto.LoginRequest;
import com.towin.auth.dto.RegisterRequest;
import com.towin.auth.security.JwtUtil;
import com.towin.auth.security.LoginRateLimiter;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.EmailService;
import com.towin.common.service.PostHogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtUtil jwtUtil;
    @Mock LoginRateLimiter loginRateLimiter;
    @Mock PostHogService postHogService;
    @Mock EmailService emailService;
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
        UUID userId = UUID.randomUUID();

        when(userRepository.existsByUsername(any())).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("hashed");
        when(userRepository.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(userId);
            return u;
        });
        // RegisterRequest carries no email, so the token is minted with a null email claim.
        when(jwtUtil.generateToken(userId.toString(), null, "ELDER", 0, false)).thenReturn("mock-token");

        var response = authService.register(req);

        assertThat(response.getToken()).isEqualTo("mock-token");
        assertThat(response.getRole()).isEqualTo("ELDER");
        assertThat(response.getUserId()).isEqualTo(userId.toString());
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
        when(jwtUtil.generateToken(userId.toString(), null, "ELDER", 0, false)).thenReturn("mock-token");

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
        when(jwtUtil.generateToken(userId.toString(), null, "ELDER", 0, false)).thenReturn("mock-token");

        var response = authService.login(req);

        assertThat(response.getToken()).isEqualTo("mock-token");
    }

    private RegisterRequest registerRequest() {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("testuser");
        req.setPassword("password123");
        req.setRole(UserRole.ELDER);
        return req;
    }
}
