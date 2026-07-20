package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyAlertRepository;
import com.towin.family.repository.FamilyLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * US-008: FamilyService recalculates the ELDER's trust score on accept and on
 * revoke, so the +1-per-active-link component stays consistent automatically.
 */
@ExtendWith(MockitoExtension.class)
class FamilyServiceTrustRecalcTest {

    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyAlertRepository familyAlertRepository;
    @Mock UserRepository userRepository;
    @Mock TrustScoreService trustScoreService;
    @Mock com.towin.profile.repository.ElderProfileRepository elderProfileRepository;
    @Mock com.towin.profile.repository.HelperProfileRepository helperProfileRepository;

    FamilyService familyService;

    private User elder;
    private User daughter;

    @BeforeEach
    void setUp() {
        familyService = new FamilyService(
                familyLinkRepository, familyAlertRepository, userRepository, trustScoreService,
                elderProfileRepository, helperProfileRepository);
        elder = buildUser("margaret_elder", UserRole.ELDER);
        daughter = buildUser("sarah_daughter", UserRole.FAMILY);
    }

    private User buildUser(String username, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .email(username + "@test.com")
                .role(role)
                .build();
    }

    private FamilyLink link(User initiatedBy, FamilyLinkStatus status) {
        FamilyLink l = FamilyLink.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .familyUser(daughter)
                .initiatedBy(initiatedBy)
                .relationship("Daughter")
                .status(status)
                .isPrimary(false)
                .build();
        when(familyLinkRepository.findById(l.getId())).thenReturn(Optional.of(l));
        return l;
    }

    private void stubSave() {
        when(familyLinkRepository.save(any(FamilyLink.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void accept_recalculatesElderTrustScore() {
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING);
        stubSave();

        familyService.respond(daughter.getId(), pending.getId(), true);

        verify(trustScoreService).recalculate(elder.getId());
    }

    @Test
    void decline_doesNotRecalculate() {
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING);
        stubSave();

        familyService.respond(daughter.getId(), pending.getId(), false);

        verifyNoInteractions(trustScoreService);
    }

    @Test
    void revokeActiveLink_recalculatesElderTrustScore() {
        FamilyLink active = link(elder, FamilyLinkStatus.ACTIVE);
        stubSave();

        familyService.revoke(daughter.getId(), active.getId());

        verify(trustScoreService).recalculate(elder.getId());
    }

    @Test
    void cancelPendingRequest_doesNotRecalculate() {
        FamilyLink pending = link(elder, FamilyLinkStatus.PENDING);
        stubSave();

        familyService.revoke(elder.getId(), pending.getId());

        verifyNoInteractions(trustScoreService);
    }
}
