package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

/**
 * Which face we show, and in what order we look for it. The case that drove
 * this: a family account has neither profile, so before the account-level
 * fallback existed their photo could not be shown however it was stored.
 */
@ExtendWith(MockitoExtension.class)
class ProfilePhotoResolverTest {

    @Mock ElderProfileRepository elderProfiles;
    @Mock HelperProfileRepository helperProfiles;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder().id(UUID.randomUUID()).build();
        lenient().when(elderProfiles.findByUserId(user.getId())).thenReturn(Optional.empty());
        lenient().when(helperProfiles.findByUserId(user.getId())).thenReturn(Optional.empty());
    }

    @Test
    void aFamilyMemberWithNoProfileUsesTheirAccountPhoto() {
        user.setPhotoUrl("/demo/sarah.jpg");

        assertThat(ProfilePhotoResolver.resolve(elderProfiles, helperProfiles, user))
                .isEqualTo("/demo/sarah.jpg");
    }

    @Test
    void anElderProfilePhotoWinsOverTheAccountOne() {
        user.setPhotoUrl("/demo/stale.jpg");
        lenient().when(elderProfiles.findByUserId(user.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().photoUrl("https://b.s3.us-east-1.amazonaws.com/real.jpg").build()));

        assertThat(ProfilePhotoResolver.resolve(elderProfiles, helperProfiles, user))
                .isEqualTo("https://b.s3.us-east-1.amazonaws.com/real.jpg");
    }

    @Test
    void aHelperProfilePhotoIsUsedWhenThereIsNoElderOne() {
        lenient().when(helperProfiles.findByUserId(user.getId()))
                .thenReturn(Optional.of(HelperProfile.builder().photoUrl("helper.jpg").build()));

        assertThat(ProfilePhotoResolver.resolve(elderProfiles, helperProfiles, user))
                .isEqualTo("helper.jpg");
    }

    /** A blank profile photo is not a photo — fall past it, don't return "". */
    @Test
    void aBlankProfilePhotoFallsThroughToTheAccount() {
        user.setPhotoUrl("/demo/sarah.jpg");
        lenient().when(elderProfiles.findByUserId(user.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().photoUrl("  ").build()));

        assertThat(ProfilePhotoResolver.resolve(elderProfiles, helperProfiles, user))
                .isEqualTo("/demo/sarah.jpg");
    }

    @Test
    void nobodyWithAPhotoAnywhereResolvesToNull() {
        assertThat(ProfilePhotoResolver.resolve(elderProfiles, helperProfiles, user)).isNull();
    }
}
