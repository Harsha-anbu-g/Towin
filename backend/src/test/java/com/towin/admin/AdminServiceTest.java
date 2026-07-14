package com.towin.admin;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.seed.DemoDataSeeder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock UserRepository userRepository;
    @Mock com.towin.profile.repository.ElderProfileRepository elderProfileRepository;
    @Mock com.towin.profile.repository.HelperProfileRepository helperProfileRepository;
    @Mock com.towin.common.service.S3Service s3Service;
    @Mock ObjectProvider<DemoDataSeeder> demoDataSeederProvider;
    @Mock DemoDataSeeder demoDataSeeder;
    @InjectMocks AdminService adminService;

    @Test
    void getAllUsers_boundsTheListToADefaultPageSize() {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(userRepository.findAll(pageable.capture())).thenReturn(Page.empty());

        adminService.getAllUsers();

        assertThat(pageable.getValue().getPageSize()).isEqualTo(AdminService.DEFAULT_PAGE_SIZE);
        verify(userRepository, never()).findAll();
    }

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

    @Test
    void resetDemoData_runsSeederReset() {
        when(demoDataSeederProvider.getIfAvailable()).thenReturn(demoDataSeeder);
        when(demoDataSeeder.isResetEnabled()).thenReturn(true);

        adminService.resetDemoData();

        verify(demoDataSeeder).resetDemo();
    }

    @Test
    void resetDemoData_failsWhenSeedingDisabled() {
        when(demoDataSeederProvider.getIfAvailable()).thenReturn(null);

        assertThatThrownBy(() -> adminService.resetDemoData())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SEED");
    }

    @Test
    void resetDemoData_failsWhenResetDisabled() {
        when(demoDataSeederProvider.getIfAvailable()).thenReturn(demoDataSeeder);
        when(demoDataSeeder.isResetEnabled()).thenReturn(false);

        assertThatThrownBy(() -> adminService.resetDemoData())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RESET");

        // resetDemo() would silently keep visitor data — must not be called.
        verify(demoDataSeeder, never()).resetDemo();
    }
}
