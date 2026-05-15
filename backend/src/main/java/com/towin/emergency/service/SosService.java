package com.towin.emergency.service;

import com.towin.emergency.entity.EmergencyContact;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SosService {

    private final EmergencyContactService contactService;

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${twilio.from-number:}")
    private String fromNumber;

    public void triggerSos(UUID elderId) {
        List<EmergencyContact> contacts = contactService.getContactEntities(elderId);
        if (contacts.isEmpty()) {
            log.warn("SOS triggered by elder {} but no emergency contacts found", elderId);
            return;
        }
        contacts.forEach(contact -> sendSms(contact.getPhone(),
                "URGENT: Your contact needs immediate help. Please check on them right away."));
        log.info("SOS sent to {} contacts for elder {}", contacts.size(), elderId);
    }

    public void notifyFirstMeet(UUID elderId, UUID connectionId) {
        List<EmergencyContact> contacts = contactService.getContactEntities(elderId);
        if (contacts.isEmpty()) return;
        contacts.forEach(contact -> sendSms(contact.getPhone(),
                "Your contact has arranged their first in-person meeting (connection: " + connectionId + "). Stay alert."));
        log.info("FIRST_MEET notification sent to {} contacts for elder {}", contacts.size(), elderId);
    }

    private static final int INACTIVITY_DAYS = 5;

    public void sendSmsPublic(String toNumber, String body) {
        sendSms(toNumber, body);
    }

    public void sendInactivityAlert(String toPhone, com.towin.common.entity.User elder) {
        sendSms(toPhone,
            "Your contact on ToWin has not been active for " + INACTIVITY_DAYS +
            " days. Please check in on them.");
    }

    private void sendSms(String toNumber, String body) {
        if (accountSid.isBlank() || authToken.isBlank() || fromNumber.isBlank()) {
            log.info("Twilio not configured — would send SMS to {}: {}", toNumber, body);
            return;
        }
        try {
            com.twilio.Twilio.init(accountSid, authToken);
            com.twilio.rest.api.v2010.account.Message.creator(
                    new com.twilio.type.PhoneNumber(toNumber),
                    new com.twilio.type.PhoneNumber(fromNumber),
                    body
            ).create();
            log.info("SMS sent to {}", toNumber);
        } catch (Exception e) {
            log.error("Failed to send SMS to {}: {}", toNumber, e.getMessage());
        }
    }
}
