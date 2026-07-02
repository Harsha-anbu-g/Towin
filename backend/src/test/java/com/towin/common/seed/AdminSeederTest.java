package com.towin.common.seed;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminSeederTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock PlatformTransactionManager transactionManager;
    @InjectMocks AdminSeeder adminSeeder;

    private void configure(String email, String password) {
        ReflectionTestUtils.setField(adminSeeder, "adminEmail", email);
        ReflectionTestUtils.setField(adminSeeder, "adminPassword", password);
    }

    @Test
    void skipsWhenConfigBlank() {
        configure("", "");

        adminSeeder.run(null);

        verifyNoInteractions(userRepository, passwordEncoder, transactionManager);
    }

    @Test
    void skipsWhenPasswordMissing() {
        configure("admin@towin.com", "  ");

        adminSeeder.run(null);

        verifyNoInteractions(userRepository, passwordEncoder);
    }

    @Test
    void createsAdminWhenMissing() {
        configure("admin@towin.com", "s3cret");
        when(userRepository.findByEmail("admin@towin.com")).thenReturn(Optional.empty());
        when(userRepository.existsByUsername("admin")).thenReturn(false);
        when(passwordEncoder.encode("s3cret")).thenReturn("HASH");

        adminSeeder.run(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        User u = saved.getValue();
        assertThat(u.getEmail()).isEqualTo("admin@towin.com");
        assertThat(u.getUsername()).isEqualTo("admin");
        assertThat(u.getPasswordHash()).isEqualTo("HASH");
        assertThat(u.getRole()).isEqualTo(UserRole.ADMIN);
    }

    @Test
    void rotatesPasswordWhenDrifted() {
        User existing = User.builder()
                .email("admin@towin.com")
                .username("admin")
                .role(UserRole.ADMIN)
                .passwordHash("OLD_MIGRATION_HASH")
                .isActive(true)
                .build();
        configure("admin@towin.com", "newpass");
        when(userRepository.findByEmail("admin@towin.com")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("newpass", "OLD_MIGRATION_HASH")).thenReturn(false);
        when(passwordEncoder.encode("newpass")).thenReturn("NEW_HASH");

        adminSeeder.run(null);

        assertThat(existing.getPasswordHash()).isEqualTo("NEW_HASH");
        verify(userRepository).save(existing);
    }

    @Test
    void promotesExistingUserToAdmin() {
        User existing = User.builder()
                .email("admin@towin.com")
                .username("admin")
                .role(UserRole.ELDER)
                .passwordHash("CURRENT")
                .isActive(true)
                .build();
        configure("admin@towin.com", "pw");
        when(userRepository.findByEmail("admin@towin.com")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("pw", "CURRENT")).thenReturn(true); // password already matches

        adminSeeder.run(null);

        assertThat(existing.getRole()).isEqualTo(UserRole.ADMIN);
        verify(userRepository).save(existing);
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    void noWriteWhenAlreadyReconciled() {
        User existing = User.builder()
                .email("admin@towin.com")
                .username("admin")
                .role(UserRole.ADMIN)
                .passwordHash("CURRENT")
                .isActive(true)
                .build();
        configure("admin@towin.com", "pw");
        when(userRepository.findByEmail("admin@towin.com")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("pw", "CURRENT")).thenReturn(true);

        adminSeeder.run(null);

        verify(userRepository, never()).save(any());
    }
}
