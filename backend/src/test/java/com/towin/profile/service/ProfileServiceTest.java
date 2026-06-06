package com.towin.profile.service;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.profile.dto.ElderProfileRequest;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @InjectMocks ProfileService profileService;

    @Test
    void shouldCreateElderProfile() {
        UUID userId = UUID.randomUUID();
        User user = User.builder()
                .id(userId)
                .email("test@test.com")
                .phone("+1234567890")
                .passwordHash("hash")
                .role(UserRole.ELDER)
                .trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(elderProfileRepository.save(any(ElderProfile.class))).thenAnswer(i -> i.getArgument(0));

        ElderProfileRequest request = new ElderProfileRequest();
        request.setName("John Elder");
        request.setAge(72);

        assertThatNoException().isThrownBy(
                () -> profileService.createOrUpdateElderProfile(userId, request));

        verify(elderProfileRepository).save(any(ElderProfile.class));
    }

    @Test
    void shouldThrowWhenUserNotFound() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        ElderProfileRequest request = new ElderProfileRequest();
        request.setName("John");
        request.setAge(70);

        assertThatThrownBy(() -> profileService.createOrUpdateElderProfile(userId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }
}
