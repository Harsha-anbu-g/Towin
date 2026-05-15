package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.emergency.entity.EmergencyContact;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InactivityCheckService {

    private final UserRepository userRepository;
    private final EmergencyContactService contactService;
    private final SosService sosService;

    private static final int INACTIVITY_DAYS = 5;
    private static final int ALERT_COOLDOWN_DAYS = 7;

    @Scheduled(cron = "0 0 9 * * *")
    @Transactional
    public void checkInactiveElders() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(INACTIVITY_DAYS);
        LocalDateTime alertCutoff = LocalDateTime.now().minusDays(ALERT_COOLDOWN_DAYS);

        List<User> inactiveElders = userRepository.findInactiveElders(cutoff, alertCutoff);
        log.info("Inactivity check: {} elder(s) to notify", inactiveElders.size());

        for (User elder : inactiveElders) {
            try {
                List<EmergencyContact> contacts = contactService.getContactEntities(elder.getId());
                contacts.forEach(c -> sosService.sendInactivityAlert(c.getPhone(), elder));
                elder.setInactivityAlertedAt(LocalDateTime.now());
                userRepository.save(elder);
                log.info("Inactivity alert sent for elder {}", elder.getId());
            } catch (Exception e) {
                log.error("Failed to alert for elder {}: {}", elder.getId(), e.getMessage());
            }
        }
    }
}
