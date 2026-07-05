package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.emergency.entity.EmergencyContact;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class InactivityCheckServiceTest {

    @Mock UserRepository userRepository;
    @Mock EmergencyContactService contactService;
    @Mock SosService sosService;

    @InjectMocks InactivityCheckService inactivityCheckService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    private User elder() {
        return User.builder()
                .id(UUID.randomUUID())
                .email("elder@t.com")
                .role(UserRole.ELDER)
                .build();
    }

    private EmergencyContact contact(String phone) {
        return EmergencyContact.builder().name("Daughter").phone(phone).build();
    }

    private void inactiveElders(User... elders) {
        when(userRepository.findInactiveElders(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(elders));
    }

    @Test
    void noInactiveElders_sendsNothing() {
        inactiveElders();

        inactivityCheckService.checkInactiveElders();

        verifyNoInteractions(contactService, sosService);
        verify(userRepository, never()).save(any());
    }

    @Test
    void inactiveElder_alertsEveryContactAndStampsAlertTime() {
        User elder = elder();
        inactiveElders(elder);
        when(contactService.getContactEntities(elder.getId()))
                .thenReturn(List.of(contact("+15551110001"), contact("+15551110002")));

        inactivityCheckService.checkInactiveElders();

        verify(sosService).sendInactivityAlert("+15551110001", elder);
        verify(sosService).sendInactivityAlert("+15551110002", elder);
        assertThat(elder.getInactivityAlertedAt())
                .isCloseTo(LocalDateTime.now(), within(5, ChronoUnit.SECONDS));
        verify(userRepository).save(elder);
    }

    @Test
    void elderWithNoContacts_isStillMarkedAlerted_soNobodyIsEverTold() {
        // Documents current behavior: with zero contacts nobody is notified, yet the
        // elder is stamped as alerted and skipped for the next 7-day cooldown window.
        User elder = elder();
        inactiveElders(elder);
        when(contactService.getContactEntities(elder.getId())).thenReturn(List.of());

        inactivityCheckService.checkInactiveElders();

        verifyNoInteractions(sosService);
        assertThat(elder.getInactivityAlertedAt()).isNotNull();
        verify(userRepository).save(elder);
    }

    @Test
    void oneElderFailing_doesNotBlockAlertsForTheOthers() {
        User broken = elder();
        User healthy = elder();
        inactiveElders(broken, healthy);
        when(contactService.getContactEntities(broken.getId()))
                .thenThrow(new RuntimeException("db hiccup"));
        when(contactService.getContactEntities(healthy.getId()))
                .thenReturn(List.of(contact("+15551110001")));

        inactivityCheckService.checkInactiveElders();

        verify(sosService).sendInactivityAlert("+15551110001", healthy);
        verify(userRepository).save(healthy);
        // The failed elder is not stamped, so it will be retried on the next run.
        assertThat(broken.getInactivityAlertedAt()).isNull();
        verify(userRepository, never()).save(broken);
    }

    @Test
    void queriesWithFiveDayInactivityAndSevenDayCooldownWindows() {
        inactiveElders();

        inactivityCheckService.checkInactiveElders();

        ArgumentCaptor<LocalDateTime> cutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> alertCutoff = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(userRepository).findInactiveElders(cutoff.capture(), alertCutoff.capture());

        assertThat(cutoff.getValue())
                .isCloseTo(LocalDateTime.now().minusDays(5), within(5, ChronoUnit.SECONDS));
        assertThat(alertCutoff.getValue())
                .isCloseTo(LocalDateTime.now().minusDays(7), within(5, ChronoUnit.SECONDS));
    }
}
