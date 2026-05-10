package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.emergency.dto.EmergencyContactRequest;
import com.towin.emergency.dto.EmergencyContactResponse;
import com.towin.emergency.entity.EmergencyContact;
import com.towin.emergency.repository.EmergencyContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmergencyContactService {

    private static final int MAX_CONTACTS = 3;

    private final EmergencyContactRepository contactRepository;
    private final UserRepository userRepository;

    public List<EmergencyContactResponse> listContacts(UUID elderId) {
        return contactRepository.findByElderId(elderId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public EmergencyContactResponse addContact(UUID elderId, EmergencyContactRequest request) {
        User elder = getElder(elderId);
        if (contactRepository.countByElderId(elderId) >= MAX_CONTACTS) {
            throw new IllegalStateException("Maximum of " + MAX_CONTACTS + " emergency contacts allowed");
        }
        EmergencyContact contact = EmergencyContact.builder()
                .elder(elder)
                .name(request.getName())
                .phone(request.getPhone())
                .relationship(request.getRelationship())
                .inactivityDays(request.getInactivityDays())
                .build();
        return toResponse(contactRepository.save(contact));
    }

    @Transactional
    public void removeContact(UUID contactId, UUID elderId) {
        EmergencyContact contact = contactRepository.findById(contactId)
                .orElseThrow(() -> new IllegalArgumentException("Contact not found"));
        if (!contact.getElder().getId().equals(elderId)) {
            throw new IllegalStateException("Not your emergency contact");
        }
        contactRepository.delete(contact);
    }

    public List<EmergencyContact> getContactEntities(UUID elderId) {
        return contactRepository.findByElderId(elderId);
    }

    private User getElder(UUID elderId) {
        User user = userRepository.findById(elderId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getRole() != UserRole.ELDER) {
            throw new IllegalStateException("Only elders can have emergency contacts");
        }
        return user;
    }

    private EmergencyContactResponse toResponse(EmergencyContact c) {
        return EmergencyContactResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .phone(c.getPhone())
                .relationship(c.getRelationship())
                .inactivityDays(c.getInactivityDays())
                .build();
    }
}
