package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.emergency.entity.EmergencyContact;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SosServiceTest {

    @Mock EmergencyContactService contactService;

    @InjectMocks SosService sosService;

    UUID elderId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        // @Value fields are never injected in a plain unit test; default to "not configured"
        // (blank, exactly what Spring injects when the properties are absent).
        twilioUnconfigured();
    }

    private void twilioConfigured() {
        ReflectionTestUtils.setField(sosService, "accountSid", "AC-test");
        ReflectionTestUtils.setField(sosService, "authToken", "token-test");
        ReflectionTestUtils.setField(sosService, "fromNumber", "+15550009999");
    }

    private void twilioUnconfigured() {
        ReflectionTestUtils.setField(sosService, "accountSid", "");
        ReflectionTestUtils.setField(sosService, "authToken", "");
        ReflectionTestUtils.setField(sosService, "fromNumber", "");
    }

    private EmergencyContact contact(String phone) {
        return EmergencyContact.builder().name("Next of kin").phone(phone).build();
    }

    private void contacts(EmergencyContact... cs) {
        when(contactService.getContactEntities(elderId)).thenReturn(List.of(cs));
    }

    private MessageCreator stubCreator(MockedStatic<Message> message) {
        MessageCreator creator = mock(MessageCreator.class);
        message.when(() -> Message.creator(any(PhoneNumber.class), any(PhoneNumber.class), anyString()))
                .thenReturn(creator);
        return creator;
    }

    // ── triggerSos ───────────────────────────────────────────────────────────

    @Test
    void triggerSos_withNoContacts_sendsNoSms() {
        twilioConfigured();
        contacts();

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {

            assertThatCode(() -> sosService.triggerSos(elderId)).doesNotThrowAnyException();

            message.verifyNoInteractions();
        }
    }

    @Test
    void triggerSos_sendsUrgentSmsToEveryContact() {
        twilioConfigured();
        contacts(contact("+15551110001"), contact("+15551110002"));

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {
            MessageCreator creator = stubCreator(message);

            sosService.triggerSos(elderId);

            ArgumentCaptor<PhoneNumber> to = ArgumentCaptor.forClass(PhoneNumber.class);
            ArgumentCaptor<PhoneNumber> from = ArgumentCaptor.forClass(PhoneNumber.class);
            ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
            message.verify(() -> Message.creator(to.capture(), from.capture(), body.capture()), times(2));

            assertThat(to.getAllValues())
                    .extracting(PhoneNumber::getEndpoint)
                    .containsExactly("+15551110001", "+15551110002");
            assertThat(from.getAllValues())
                    .extracting(PhoneNumber::getEndpoint)
                    .containsOnly("+15550009999");
            assertThat(body.getAllValues()).allSatisfy(b ->
                    assertThat(b).contains("URGENT").contains("immediate help"));
            verify(creator, times(2)).create();
        }
    }

    @Test
    void triggerSos_whenTwilioNotConfigured_suppressesSmsInsteadOfCrashing() {
        // twilioUnconfigured() already applied in setUp
        contacts(contact("+15551110001"));

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {

            assertThatCode(() -> sosService.triggerSos(elderId)).doesNotThrowAnyException();

            message.verifyNoInteractions();
            twilio.verifyNoInteractions();
        }
    }

    @Test
    void triggerSos_oneFailedSend_stillAlertsRemainingContacts() {
        twilioConfigured();
        contacts(contact("+15551110001"), contact("+15551110002"));

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {
            MessageCreator creator = stubCreator(message);
            when(creator.create())
                    .thenThrow(new RuntimeException("twilio down"))
                    .thenReturn(null);

            assertThatCode(() -> sosService.triggerSos(elderId)).doesNotThrowAnyException();

            // Both contacts were attempted despite the first send blowing up.
            verify(creator, times(2)).create();
        }
    }

    // ── notifyFirstMeet ──────────────────────────────────────────────────────

    @Test
    void notifyFirstMeet_tellsEveryContactAboutTheMeeting() {
        twilioConfigured();
        UUID connectionId = UUID.randomUUID();
        contacts(contact("+15551110001"));

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {
            stubCreator(message);

            sosService.notifyFirstMeet(elderId, connectionId);

            ArgumentCaptor<PhoneNumber> to = ArgumentCaptor.forClass(PhoneNumber.class);
            ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
            message.verify(() -> Message.creator(to.capture(), any(PhoneNumber.class), body.capture()));

            assertThat(to.getValue().getEndpoint()).isEqualTo("+15551110001");
            assertThat(body.getValue())
                    .contains("first in-person meeting")
                    .contains(connectionId.toString());
        }
    }

    @Test
    void notifyFirstMeet_withNoContacts_sendsNothing() {
        twilioConfigured();
        contacts();

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {

            sosService.notifyFirstMeet(elderId, UUID.randomUUID());

            message.verifyNoInteractions();
        }
    }

    // ── sendInactivityAlert ──────────────────────────────────────────────────

    @Test
    void sendInactivityAlert_asksContactToCheckOnElder() {
        twilioConfigured();
        User elder = User.builder().id(UUID.randomUUID()).build();

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {
            stubCreator(message);

            sosService.sendInactivityAlert("+15551110001", elder);

            ArgumentCaptor<PhoneNumber> to = ArgumentCaptor.forClass(PhoneNumber.class);
            ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
            message.verify(() -> Message.creator(to.capture(), any(PhoneNumber.class), body.capture()));

            assertThat(to.getValue().getEndpoint()).isEqualTo("+15551110001");
            assertThat(body.getValue())
                    .contains("not been active for 5 days")
                    .contains("check in");
        }
    }

    // ── sendSmsPublic ────────────────────────────────────────────────────────

    @Test
    void sendSmsPublic_whenTwilioNotConfigured_doesNotThrow() {
        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {

            assertThatCode(() -> sosService.sendSmsPublic("+15551110001", "hello"))
                    .doesNotThrowAnyException();

            message.verifyNoInteractions();
        }
    }

    @Test
    void sendSmsPublic_whenSendFails_throwsSoCallerKnows() {
        twilioConfigured();

        try (MockedStatic<Twilio> twilio = mockStatic(Twilio.class);
             MockedStatic<Message> message = mockStatic(Message.class)) {
            MessageCreator creator = stubCreator(message);
            when(creator.create()).thenThrow(new RuntimeException("bad number"));

            assertThatThrownBy(() -> sosService.sendSmsPublic("+15551110001", "hello"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Could not send verification code");
        }
    }
}
