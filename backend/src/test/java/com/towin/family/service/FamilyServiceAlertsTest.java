package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.repository.UserRepository;
import com.towin.family.dto.FamilyAlertsResponse;
import com.towin.family.entity.FamilyAlert;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyAlertRepository;
import com.towin.family.repository.FamilyLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** US-007: GET /api/family/alerts — the caller's ACTIVE linked elders' alerts, newest first. */
class FamilyServiceAlertsTest {

    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyAlertRepository familyAlertRepository;
    @Mock UserRepository userRepository;
    @Mock com.towin.common.service.TrustScoreService trustScoreService;

    @InjectMocks FamilyService familyService;

    UUID callerId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    private User user(String username, String fullName) {
        return User.builder().id(UUID.randomUUID()).username(username).fullName(fullName).build();
    }

    private FamilyLink activeLinkTo(User elder) {
        return FamilyLink.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .familyUser(User.builder().id(callerId).username("me").build())
                .status(FamilyLinkStatus.ACTIVE)
                .build();
    }

    private FamilyAlert alert(User elder, String type, String body, LocalDateTime at) {
        return FamilyAlert.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .type(type)
                .body(body)
                .createdAt(at)
                .build();
    }

    @Test
    void getAlerts_returnsLinkedEldersAlertsNewestFirst() {
        User mom = user("marge", "Marge Elder");
        User dad = user("homer", "Homer Elder");
        when(familyLinkRepository.findByFamilyUserIdAndStatus(callerId, FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(activeLinkTo(mom), activeLinkTo(dad)));

        LocalDateTime now = LocalDateTime.now();
        FamilyAlert newest = alert(dad, "SOS", "Pressed the SOS button.", now);
        FamilyAlert older = alert(mom, "INACTIVITY", "Not active for 5 days.", now.minusHours(3));
        when(familyAlertRepository.findByElderIdInOrderByCreatedAtDesc(argThat(
                (Collection<UUID> ids) -> ids != null && ids.size() == 2
                        && ids.contains(mom.getId()) && ids.contains(dad.getId()))))
                .thenReturn(List.of(newest, older));

        FamilyAlertsResponse response = familyService.getAlerts(callerId);

        assertThat(response.getAlerts()).hasSize(2);
        assertThat(response.getAlerts().get(0).getType()).isEqualTo("SOS");
        assertThat(response.getAlerts().get(0).getElderId()).isEqualTo(dad.getId());
        assertThat(response.getAlerts().get(0).getElderName()).isEqualTo("Homer Elder");
        assertThat(response.getAlerts().get(0).getBody()).contains("SOS");
        assertThat(response.getAlerts().get(0).getCreatedAt()).isEqualTo(now);
        assertThat(response.getAlerts().get(1).getType()).isEqualTo("INACTIVITY");
        assertThat(response.getAlerts().get(1).getElderId()).isEqualTo(mom.getId());
    }

    @Test
    void getAlerts_elderNameFallsBackToUsernameWhenNoFullName() {
        User mom = user("marge", null);
        when(familyLinkRepository.findByFamilyUserIdAndStatus(callerId, FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(activeLinkTo(mom)));
        when(familyAlertRepository.findByElderIdInOrderByCreatedAtDesc(anyCollection()))
                .thenReturn(List.of(alert(mom, "SOS", "Pressed the SOS button.", LocalDateTime.now())));

        FamilyAlertsResponse response = familyService.getAlerts(callerId);

        assertThat(response.getAlerts().get(0).getElderName()).isEqualTo("marge");
    }

    @Test
    void getAlerts_withNoActiveLinks_returnsEmptyFeedWithoutQueryingAlerts() {
        when(familyLinkRepository.findByFamilyUserIdAndStatus(callerId, FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of());

        FamilyAlertsResponse response = familyService.getAlerts(callerId);

        assertThat(response.getAlerts()).isEmpty();
        verify(familyAlertRepository, never()).findByElderIdInOrderByCreatedAtDesc(anyCollection());
    }
}
