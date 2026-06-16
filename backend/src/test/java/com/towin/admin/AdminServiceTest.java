package com.towin.admin;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock UserRepository userRepository;
    @InjectMocks AdminService adminService;

    private User user(UserRole role) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setRole(role);
        u.setIsActive(true);
        return u;
    }

    @Test
    void suspendUser_deactivatesNonAdmin() {
        User helper = user(UserRole.HELPER);
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));

        adminService.suspendUser(helper.getId());

        assertThat(helper.getIsActive()).isFalse();
        verify(userRepository).save(helper);
    }

    @Test
    void suspendUser_refusesToSuspendAdmin() {
        User admin = user(UserRole.ADMIN);
        when(userRepository.findById(admin.getId())).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> adminService.suspendUser(admin.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("admin");

        // The admin stays active and nothing is persisted — no self-lockout possible.
        assertThat(admin.getIsActive()).isTrue();
        verify(userRepository, never()).save(any());
    }
}
