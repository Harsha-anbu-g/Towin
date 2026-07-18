package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.common.exception.RateLimitException;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.entity.EmergencyContact;
import com.towin.emergency.security.SosRateLimiter;
import com.towin.family.entity.FamilyAlert;
import com.towin.family.repository.FamilyAlertRepository;
import com.towin.family.repository.FamilyLinkRepository;
import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.rest.api.v2010.account.MessageCreator;
import com.twilio.type.PhoneNumber;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.MockitoAnnotations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * US-007: family alerts are in-app rows in family_alerts — never email, never SMS.
 * The legacy emergency_contacts SMS path stays exactly as it was.
 */
class SosServiceFamilyAlertsTest {

    @Mock EmergencyContactService contactService;
    @Mock SosRateLimiter sosRateLimiter;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyAlertRepository familyAlertRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock UserRepository userRepository;

    @InjectMocks SosService sosService;

    UUID elderId = UUID.randomUUID();
    User elder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(sosService, "accountSid", "");
        ReflectionTestUtils.setField(sosService, "authToken", "");
        ReflectionTestUtils.setField(sosService, "fromNumber", "");
        elder = User.builder().id(elderId).username("marge").fullName("Marge Elder").build();
        when(userRepository.getReferenceById(elderId)).thenReturn(elder);
        when(contactService.getContactEntities(elderId)).thenReturn(List.of());
    }

    private void activeLinks(long count) {
        // Only ACTIVE links gate family alerts (pending/declined/revoked never do).
        when(familyLinkRepository.countByElderIdAndStatusIn(eq(elderId), anyCollection()))
                .thenReturn(count);
    }

    private FamilyAlert savedAlert() {
        ArgumentCaptor<FamilyAlert> captor = ArgumentCaptor.forClass(FamilyAlert.class);
        verify(familyAlertRepository).save(captor.capture());
        return captor.getValue();
    }

    // ── triggerSos ───────────────────────────────────────────────────────────

    @Test
    void triggerSos_withActiveLink_writesOneSosAlertRow() {
        activeLinks(1);

        sosService.triggerSos(elderId);

        FamilyAlert alert = savedAlert();
        assertThat(alert.getType()).isEqualTo("SOS");
        assertThat(alert.getElder().getId()).isEqualTo(elderId);
        assertThat(alert.getBody()).containsIgnoringCase("help");
    }

    @Test
    void triggerSos_withActiveLinkButNoEmergencyContacts_stillWritesTheRow() {
        // Family alerts don't depend on the legacy SMS contact list at all.
        activeLinks(1);

        assertThatCode(() -> sosService.triggerSos(elderId)).doesNotThrowAnyException();

        assertThat(savedAlert().getType()).isEqualTo("SOS");
    }

    @Test
    void triggerSos_withZeroLinks_writesNoRowAndDoesNotFail() {
        activeLinks(0);

        assertThatCode(() -> sosService.triggerSos(elderId)).doesNotThrowAnyException();

        verify(familyAlertRepository, never()).save(any());
    }

    @Test
    void triggerSos_whenRateLimited_writesNoRow() {
        // SosRateLimiter stays authoritative: no alert fires, no row is written.
        activeLinks(1);
        doThrow(new RateLimitException("Your alert was already sent."))
                .when(sosRateLimiter).check(elderId);

        assertThatThrownBy(() -> sosService.triggerSos(elderId))
                .isInstanceOf(RateLimitException.class);

        verify(familyAlertRepository, never()).save(any());
    }

    // ── notifyFirstMeet ──────────────────────────────────────────────────────

    private Connection connection(boolean shared) {
        User helper = User.builder().id(UUID.randomUUID())
                .username("henry").fullName("Henry Helper").build();
        return Connection.builder()
                .id(UUID.randomUUID())
                .userA(elder)
                .userB(helper)
                .sharedWithFamily(shared)
                .build();
    }

    @Test
    void notifyFirstMeet_sharedConnection_writesRowNamingTheHelper() {
        activeLinks(1);
        Connection shared = connection(true);
        when(connectionRepository.findById(shared.getId())).thenReturn(Optional.of(shared));

        sosService.notifyFirstMeet(elderId, shared.getId());

        FamilyAlert alert = savedAlert();
        assertThat(alert.getType()).isEqualTo("FIRST_MEET");
        assertThat(alert.getBody()).contains("Henry Helper");
    }

    @Test
    void notifyFirstMeet_unsharedConnection_writesNoRow() {
        activeLinks(1);
        Connection privateConn = connection(false);
        when(connectionRepository.findById(privateConn.getId())).thenReturn(Optional.of(privateConn));

        sosService.notifyFirstMeet(elderId, privateConn.getId());

        verify(familyAlertRepository, never()).save(any());
    }

    @Test
    void notifyFirstMeet_zeroLinks_writesNoRowEvenWhenShared() {
        activeLinks(0);
        Connection shared = connection(true);
        when(connectionRepository.findById(shared.getId())).thenReturn(Optional.of(shared));

        assertThatCode(() -> sosService.notifyFirstMeet(elderId, shared.getId()))
                .doesNotThrowAnyException();

        verify(familyAlertRepository, never()).save(any());
    }

    @Test
    void notifyFirstMeet_unknownConnection_writesNothingAndDoesNotFail() {
        activeLinks(1);
        UUID unknown = UUID.randomUUID();
        when(connectionRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThatCode(() -> sosService.notifyFirstMeet(elderId, unknown))
                .doesNotThrowAnyException();

        verify(familyAlertRepository, never()).save(any());
    }

    // ── sendInactivityAlert ──────────────────────────────────────────────────

    @Test
    void sendInactivityAlert_writesOneRowPerEventAndStillSmsesEveryContact() {
        ReflectionTestUtils.setField(sosService, "accountSid", "AC-test");
        ReflectionTestUtils.setField(sosService, "authToken", "token-test");
        ReflectionTestUtils.setField(sosService, "fromNumber", "+15550009999");
        activeLinks(1);
        when(contactService.getContactEntities(elderId)).thenReturn(List.of(
                EmergencyContact.builder().name("Kin A").phone("+15551110001").build(),
                EmergencyContact.builder().name("Kin B").phone("+15551110002").build()));

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {
            MessageCreator creator = mock(MessageCreator.class);
            message.when(() -> Message.creator(any(PhoneNumber.class), any(PhoneNumber.class), anyString()))
                    .thenReturn(creator);

            sosService.sendInactivityAlert(elder);

            // Legacy SMS path untouched: one text per emergency contact...
            verify(creator, times(2)).create();
        }

        // ...but exactly ONE in-app family row for the event.
        FamilyAlert alert = savedAlert();
        assertThat(alert.getType()).isEqualTo("INACTIVITY");
        assertThat(alert.getElder().getId()).isEqualTo(elderId);
    }

    @Test
    void sendInactivityAlert_zeroLinks_writesNoRow() {
        activeLinks(0);

        assertThatCode(() -> sosService.sendInactivityAlert(elder)).doesNotThrowAnyException();

        verify(familyAlertRepository, never()).save(any());
    }

    @Test
    void familyAlerts_neverSendSmsThemselves() {
        // Twilio unconfigured + zero emergency contacts: writing the family row
        // must not touch the SMS machinery at all (in-app only, user decision).
        activeLinks(1);

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {

            sosService.triggerSos(elderId);

            message.verifyNoInteractions();
            twilio.verifyNoInteractions();
        }

        verify(familyAlertRepository).save(any(FamilyAlert.class));
    }
}
