package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyAlertType;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.DisplayNameResolver;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.entity.EmergencyContact;
import com.towin.emergency.security.SosRateLimiter;
import com.towin.family.entity.FamilyAlert;
import com.towin.family.repository.FamilyAlertRepository;
import com.towin.family.repository.FamilyLinkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

@Slf4j
@Service
@RequiredArgsConstructor
public class SosService {

    private final EmergencyContactService contactService;
    private final SosRateLimiter sosRateLimiter;
    private final FamilyLinkRepository familyLinkRepository;
    private final FamilyAlertRepository familyAlertRepository;
    private final ConnectionRepository connectionRepository;
    private final UserRepository userRepository;

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${twilio.from-number:}")
    private String fromNumber;

    public void triggerSos(UUID elderId) {
        sosRateLimiter.check(elderId);
        List<EmergencyContact> contacts = contactService.getContactEntities(elderId);
        if (contacts.isEmpty()) {
            log.warn("SOS triggered by elder {} but no emergency contacts found", elderId);
        } else {
            contacts.forEach(contact -> sendSms(contact.getPhone(),
                    "URGENT: Your contact needs immediate help. Please check on them right away."));
            log.info("SOS sent to {} contacts for elder {}", contacts.size(), elderId);
        }
        // In-app family alert (never email/SMS): elder-level safety, always written.
        recordFamilyAlert(elderId, () -> userRepository.getReferenceById(elderId),
                FamilyAlertType.SOS,
                "Pressed the SOS button and may need help right away.");
    }

    public void notifyFirstMeet(UUID elderId, UUID connectionId) {
        List<EmergencyContact> contacts = contactService.getContactEntities(elderId);
        if (!contacts.isEmpty()) {
            contacts.forEach(contact -> sendSms(contact.getPhone(),
                    "Your contact has arranged their first in-person meeting (connection: " + connectionId + "). Stay alert."));
            log.info("FIRST_MEET notification sent to {} contacts for elder {}", contacts.size(), elderId);
        }
        // Connection information: written ONLY when the elder shares this
        // friendship with family, and the helper is named only then (decision 5).
        connectionRepository.findById(connectionId)
                .filter(connection -> Boolean.TRUE.equals(connection.getSharedWithFamily()))
                .ifPresent(connection -> {
                    User helper = connection.getOtherUser(elderId);
                    recordFamilyAlert(elderId, () -> userRepository.getReferenceById(elderId),
                            FamilyAlertType.FIRST_MEET,
                            "Planned a first in-person meeting with " + displayName(helper) + ".");
                });
    }

    private static final int INACTIVITY_DAYS = 5;

    public void sendSmsPublic(String toNumber, String body) {
        if (accountSid.isBlank() || authToken.isBlank() || fromNumber.isBlank()) {
            log.info("Twilio not configured — SMS suppressed (dev mode)");
            return;
        }
        try {
            com.twilio.Twilio.init(accountSid, authToken);
            com.twilio.rest.api.v2010.account.Message.creator(
                    new com.twilio.type.PhoneNumber(toNumber),
                    new com.twilio.type.PhoneNumber(fromNumber),
                    body
            ).create();
            log.info("SMS sent successfully");
        } catch (Exception e) {
            log.error("Failed to send OTP SMS: {}", e.getMessage());
            throw new RuntimeException("Could not send verification code: " + e.getMessage());
        }
    }

    /**
     * One inactivity event per elder: SMS every legacy emergency contact
     * (unchanged behavior) and write ONE in-app family_alerts row.
     * The 7-day cooldown stays with the caller (InactivityCheckService).
     */
    public void sendInactivityAlert(User elder) {
        List<EmergencyContact> contacts = contactService.getContactEntities(elder.getId());
        contacts.forEach(contact -> sendSms(contact.getPhone(),
                "Your contact on ToWin has not been active for " + INACTIVITY_DAYS +
                " days. Please check in on them."));
        recordFamilyAlert(elder.getId(), () -> elder,
                FamilyAlertType.INACTIVITY,
                "Has not been active on ToWin for " + INACTIVITY_DAYS + " days. A check-in may help.");
    }

    /** Writes one family_alerts row iff the elder has >=1 ACTIVE family link. In-app only. */
    private void recordFamilyAlert(UUID elderId, Supplier<User> elderRef,
                                   FamilyAlertType type, String body) {
        long activeLinks = familyLinkRepository.countByElderIdAndStatusIn(
                elderId, List.of(FamilyLinkStatus.ACTIVE));
        if (activeLinks == 0) return;
        familyAlertRepository.save(FamilyAlert.builder()
                .elder(elderRef.get())
                .type(type.name())
                .body(body)
                .build());
        log.info("Family alert {} recorded for elder {}", type, elderId);
    }

    private String displayName(User user) {
        return DisplayNameResolver.fromUser(user);
    }

    private void sendSms(String toNumber, String body) {
        if (accountSid.isBlank() || authToken.isBlank() || fromNumber.isBlank()) {
            log.info("Twilio not configured — SMS suppressed (dev mode)");
            return;
        }
        try {
            com.twilio.Twilio.init(accountSid, authToken);
            com.twilio.rest.api.v2010.account.Message.creator(
                    new com.twilio.type.PhoneNumber(toNumber),
                    new com.twilio.type.PhoneNumber(fromNumber),
                    body
            ).create();
            log.info("SMS sent successfully");
        } catch (Exception e) {
            log.error("Failed to send SMS: {}", e.getMessage());
        }
    }
}
