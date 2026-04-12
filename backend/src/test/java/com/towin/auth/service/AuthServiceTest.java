package com.towin.auth.service;

import com.towin.auth.dto.LoginRequest;
import com.towin.auth.dto.RegisterRequest;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
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
    @InjectMocks AuthService authService;

    @Test
    void shouldThrowWhenEmailAlreadyExists() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("existing@email.com");
        req.setPhone("+1234567890");
        req.setPassword("password123");
        req.setRole(UserRole.ELDER);

        when(userRepository.existsByEmail("existing@email.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Email already registered");
    }

    @Test
    void shouldRegisterSuccessfully() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("new@email.com");
        req.setPhone("+1234567890");
        req.setPassword("password123");
        req.setRole(UserRole.ELDER);

        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(userRepository.existsByPhone(any())).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("hashed");
        when(userRepository.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            // simulate DB setting ID
            return u;
        });
        when(jwtUtil.generateToken(any(), any())).thenReturn("mock-token");

        var response = authService.register(req);
        assertThat(response.getToken()).isEqualTo("mock-token");
        assertThat(response.getRole()).isEqualTo("ELDER");
    }

    @Test
    void shouldThrowOnInvalidLoginCredentials() {
        LoginRequest req = new LoginRequest();
        req.setEmail("test@email.com");
        req.setPassword("wrongpassword");

        when(userRepository.findByEmail("test@email.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Invalid credentials");
    }
}
