package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.emergency.dto.EmergencyContactRequest;
import com.towin.emergency.dto.EmergencyContactResponse;
import com.towin.emergency.entity.EmergencyContact;
import com.towin.emergency.repository.EmergencyContactRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmergencyContactServiceTest {

    @Mock EmergencyContactRepository contactRepository;
    @Mock UserRepository userRepository;
    @InjectMocks EmergencyContactService contactService;

    private User elder;

    @BeforeEach
    void setUp() {
        elder = User.builder().id(UUID.randomUUID()).role(UserRole.ELDER).build();
    }

    @Test
    void shouldAddContact() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(contactRepository.countByElderId(elder.getId())).thenReturn(0L);
        EmergencyContact saved = EmergencyContact.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .name("Jane Doe")
                .phone("+1234567890")
                .relationship("daughter")
                .inactivityDays(5)
                .build();
        when(contactRepository.save(any())).thenReturn(saved);

        EmergencyContactRequest req = new EmergencyContactRequest();
        req.setName("Jane Doe");
        req.setPhone("+1234567890");
        req.setRelationship("daughter");

        EmergencyContactResponse result = contactService.addContact(elder.getId(), req);

        assertThat(result.getName()).isEqualTo("Jane Doe");
        assertThat(result.getPhone()).isEqualTo("+1234567890");
    }

    @Test
    void shouldRejectWhenMaxContactsReached() {
        when(userRepository.findById(elder.getId())).thenReturn(Optional.of(elder));
        when(contactRepository.countByElderId(elder.getId())).thenReturn(3L);

        EmergencyContactRequest req = new EmergencyContactRequest();
        req.setName("Extra Contact");
        req.setPhone("+9999999999");

        assertThatThrownBy(() -> contactService.addContact(elder.getId(), req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Maximum");
    }

    @Test
    void shouldRejectNonElder() {
        User helper = User.builder().id(UUID.randomUUID()).role(UserRole.HELPER).build();
        when(userRepository.findById(helper.getId())).thenReturn(Optional.of(helper));

        EmergencyContactRequest req = new EmergencyContactRequest();
        req.setName("Someone");
        req.setPhone("+1111111111");

        assertThatThrownBy(() -> contactService.addContact(helper.getId(), req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Only elders");
    }

    @Test
    void shouldRemoveContact() {
        EmergencyContact contact = EmergencyContact.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .name("Jane")
                .phone("+1234567890")
                .build();
        when(contactRepository.findById(contact.getId())).thenReturn(Optional.of(contact));

        contactService.removeContact(contact.getId(), elder.getId());

        verify(contactRepository).delete(contact);
    }

    @Test
    void shouldRejectRemoveByWrongUser() {
        UUID stranger = UUID.randomUUID();
        EmergencyContact contact = EmergencyContact.builder()
                .id(UUID.randomUUID())
                .elder(elder)
                .name("Jane")
                .phone("+1234567890")
                .build();
        when(contactRepository.findById(contact.getId())).thenReturn(Optional.of(contact));

        assertThatThrownBy(() -> contactService.removeContact(contact.getId(), stranger))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void shouldListContacts() {
        EmergencyContact c = EmergencyContact.builder()
                .id(UUID.randomUUID()).elder(elder).name("Jane").phone("+1").build();
        when(contactRepository.findByElderId(elder.getId())).thenReturn(List.of(c));

        List<EmergencyContactResponse> result = contactService.listContacts(elder.getId());

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Jane");
    }
}
