package com.towin.messaging.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.MessageChannel;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.entity.FamilyLink;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.messaging.dto.MessageRequest;
import com.towin.messaging.dto.MessageResponse;
import com.towin.messaging.entity.Message;
import com.towin.messaging.repository.MessageRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * US-002 gate matrix for the FAMILY_UPDATES thread (Step 3 locked rules):
 * participants always keep the thread; family members read/write only while
 * connection ACTIVE + shared_with_family + trust >= FIRST_MEET and their
 * family link is ACTIVE. MAIN channel rules stay untouched.
 */
@ExtendWith(MockitoExtension.class)
class FamilyUpdatesChannelTest {

    @Mock MessageRepository messageRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock S3Service s3Service;
    @InjectMocks MessageService messageService;

    private User elder;
    private User helper;
    private User sarah;
    private Connection connection;
    private UUID connId;

    @BeforeEach
    void setUp() {
        elder = User.builder().id(UUID.randomUUID()).role(UserRole.ELDER)
                .fullName("Margaret").username("elder").build();
        helper = User.builder().id(UUID.randomUUID()).role(UserRole.HELPER)
                .fullName("Maria").username("helper").build();
        sarah = User.builder().id(UUID.randomUUID()).role(UserRole.FAMILY)
                .fullName("Sarah").username("sarah").build();
        connId = UUID.randomUUID();
        connection = Connection.builder()
                .id(connId)
                .userA(elder)
                .userB(helper)
                .status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.FIRST_MEET)
                .sharedWithFamily(true)
                .build();
        lenient().when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));
        lenient().when(elderProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        lenient().when(helperProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
    }

    private void linkSarahToElder(FamilyLinkStatus status) {
        FamilyLink link = FamilyLink.builder()
                .id(UUID.randomUUID()).elder(elder).familyUser(sarah)
                .initiatedBy(sarah).relationship("Daughter").status(status).build();
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), sarah.getId()))
                .thenReturn(Optional.of(link));
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(helper.getId(), sarah.getId()))
                .thenReturn(Optional.empty());
    }

    private void stubEmptyHistory() {
        when(messageRepository.findByConnectionIdAndChannelOrderByCreatedAtDesc(
                eq(connId), eq(MessageChannel.FAMILY_UPDATES), any()))
                .thenReturn(new PageImpl<>(List.of()));
    }

    private MessageRequest request(String content) {
        MessageRequest req = new MessageRequest();
        req.setContent(content);
        return req;
    }

    // --- Family member: allowed only while the double gate holds ---

    @Test
    void familyMemberWithActiveLinkReadsSharedThread() {
        linkSarahToElder(FamilyLinkStatus.ACTIVE);
        stubEmptyHistory();

        Page<MessageResponse> page = messageService.getHistory(
                connId, sarah.getId(), MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30));

        assertThat(page).isNotNull();
    }

    @Test
    void familyMemberWithActiveLinkWritesSharedThread() {
        linkSarahToElder(FamilyLinkStatus.ACTIVE);
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = messageService.send(
                connId, sarah.getId(), MessageChannel.FAMILY_UPDATES, request("Thank you!"));

        assertThat(response.getContent()).isEqualTo("Thank you!");
        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(captor.capture());
        assertThat(captor.getValue().getChannel()).isEqualTo(MessageChannel.FAMILY_UPDATES);
        assertThat(captor.getValue().getSender().getId()).isEqualTo(sarah.getId());
    }

    @Test
    void unsharedConnectionDeniesFamilyReadAndWrite() {
        connection.setSharedWithFamily(false);
        linkSarahToElder(FamilyLinkStatus.ACTIVE);

        assertThatThrownBy(() -> messageService.getHistory(
                connId, sarah.getId(), MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> messageService.send(
                connId, sarah.getId(), MessageChannel.FAMILY_UPDATES, request("Hi")))
                .isInstanceOf(IllegalStateException.class);
        verify(messageRepository, never()).save(any());
    }

    @Test
    void belowFirstMeetDeniesFamily() {
        connection.setCurrentTrustLevel(TrustLevel.VERIFIED);
        linkSarahToElder(FamilyLinkStatus.ACTIVE);

        assertThatThrownBy(() -> messageService.getHistory(
                connId, sarah.getId(), MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void revokedLinkDeniesFamily() {
        linkSarahToElder(FamilyLinkStatus.REVOKED);

        assertThatThrownBy(() -> messageService.getHistory(
                connId, sarah.getId(), MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void inactiveConnectionDeniesFamily() {
        connection.setStatus(ConnectionStatus.PAUSED);
        linkSarahToElder(FamilyLinkStatus.ACTIVE);

        assertThatThrownBy(() -> messageService.getHistory(
                connId, sarah.getId(), MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void strangerWithoutLinkDenied() {
        UUID stranger = UUID.randomUUID();
        when(familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), stranger))
                .thenReturn(Optional.empty());
        when(familyLinkRepository.findByElderIdAndFamilyUserId(helper.getId(), stranger))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> messageService.getHistory(
                connId, stranger, MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30)))
                .isInstanceOf(IllegalStateException.class);
    }

    // --- Participants: the elder and helper always keep the thread ---

    @Test
    void elderReadsEvenWhenUnshared() {
        connection.setSharedWithFamily(false);
        connection.setCurrentTrustLevel(TrustLevel.MESSAGING);
        stubEmptyHistory();

        Page<MessageResponse> page = messageService.getHistory(
                connId, elder.getId(), MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30));

        assertThat(page).isNotNull();
    }

    @Test
    void helperWritesToActiveConnection() {
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = messageService.send(
                connId, helper.getId(), MessageChannel.FAMILY_UPDATES, request("We did the shopping."));

        assertThat(response.getContent()).isEqualTo("We did the shopping.");
    }

    // --- Sender rendering: name + label only, never contact details ---

    @Test
    void familySenderRendersWithRelationshipLabel() {
        linkSarahToElder(FamilyLinkStatus.ACTIVE);
        stubHistoryWithMessageFrom(sarah);

        MessageResponse r = firstFamilyMessage(sarah.getId());

        assertThat(r.getSenderName()).isEqualTo("Sarah");
        assertThat(r.getSenderLabel()).isEqualTo("their daughter Sarah");
    }

    @Test
    void helperSenderRendersWithHelperLabel() {
        linkSarahToElder(FamilyLinkStatus.ACTIVE);
        stubHistoryWithMessageFrom(helper);

        MessageResponse r = firstFamilyMessage(sarah.getId());

        assertThat(r.getSenderName()).isEqualTo("Maria");
        assertThat(r.getSenderLabel()).isEqualTo("helper Maria");
    }

    @Test
    void elderSenderRendersWithPlainName() {
        linkSarahToElder(FamilyLinkStatus.ACTIVE);
        stubHistoryWithMessageFrom(elder);

        MessageResponse r = firstFamilyMessage(sarah.getId());

        assertThat(r.getSenderName()).isEqualTo("Margaret");
        assertThat(r.getSenderLabel()).isEqualTo("Margaret");
    }

    private void stubHistoryWithMessageFrom(User sender) {
        Message m = Message.builder()
                .id(UUID.randomUUID()).connection(connection).sender(sender)
                .content("Note").channel(MessageChannel.FAMILY_UPDATES).build();
        when(messageRepository.findByConnectionIdAndChannelOrderByCreatedAtDesc(
                eq(connId), eq(MessageChannel.FAMILY_UPDATES), any()))
                .thenReturn(new PageImpl<>(List.of(m)));
    }

    private MessageResponse firstFamilyMessage(UUID viewerId) {
        return messageService.getHistory(connId, viewerId,
                MessageChannel.FAMILY_UPDATES, PageRequest.of(0, 30)).getContent().get(0);
    }

    // --- MAIN channel stays untouched ---

    @Test
    void mainChannelStillRequiresMessagingTrustOnly() {
        connection.setCurrentTrustLevel(TrustLevel.MESSAGING);
        connection.setSharedWithFamily(false);
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = messageService.send(
                connId, elder.getId(), MessageChannel.MAIN, request("Hello"));

        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(captor.capture());
        assertThat(captor.getValue().getChannel()).isEqualTo(MessageChannel.MAIN);
        assertThat(response.getContent()).isEqualTo("Hello");
    }

    @Test
    void mainChannelDeniesFamilyMemberEvenWhenShared() {
        linkSarahToElder(FamilyLinkStatus.ACTIVE);

        assertThatThrownBy(() -> messageService.getHistory(
                connId, sarah.getId(), MessageChannel.MAIN, PageRequest.of(0, 30)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> messageService.send(
                connId, sarah.getId(), MessageChannel.MAIN, request("Hi")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void mainHistoryIsFilteredToMainChannel() {
        when(messageRepository.findByConnectionIdAndChannelOrderByCreatedAtDesc(
                eq(connId), eq(MessageChannel.MAIN), any()))
                .thenReturn(new PageImpl<>(List.of()));

        messageService.getHistory(connId, elder.getId(), MessageChannel.MAIN, PageRequest.of(0, 30));

        verify(messageRepository).findByConnectionIdAndChannelOrderByCreatedAtDesc(
                eq(connId), eq(MessageChannel.MAIN), any());
        verify(messageRepository, never()).findByConnectionIdOrderByCreatedAtDesc(any(), any());
    }
}
