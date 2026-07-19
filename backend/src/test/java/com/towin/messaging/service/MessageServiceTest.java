package com.towin.messaging.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.MessageChannel;
import com.towin.common.enums.MessageType;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.common.enums.TrustLevel;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.messaging.dto.MessageRequest;
import com.towin.messaging.dto.MessageResponse;
import com.towin.messaging.entity.Message;
import com.towin.messaging.repository.MessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock
    MessageRepository messageRepository;
    @Mock
    ConnectionRepository connectionRepository;
    @Mock
    FamilyLinkRepository familyLinkRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    ElderProfileRepository elderProfileRepository;
    @Mock
    HelperProfileRepository helperProfileRepository;
    @Mock
    S3Service s3Service;
    @InjectMocks
    MessageService messageService;

    private User userA;
    private User userB;
    private Connection connection;
    private UUID connId;

    @BeforeEach
    void setUp() {
        userA = User.builder().id(UUID.randomUUID()).build();
        userB = User.builder().id(UUID.randomUUID()).build();
        connId = UUID.randomUUID();
        connection = Connection.builder()
                .id(connId)
                .userA(userA)
                .userB(userB)
                .status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.MESSAGING)
                .build();
    }

    @Test
    void shouldSendMessage() {
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));
        Message saved = Message.builder()
                .id(UUID.randomUUID())
                .connection(connection)
                .sender(userA)
                .content("Hello!")
                .type(MessageType.TEXT)
                .build();
        when(messageRepository.save(any())).thenReturn(saved);

        MessageRequest req = new MessageRequest();
        req.setContent("Hello!");

        MessageResponse response = messageService.send(connId, userA.getId(), MessageChannel.MAIN, req);

        assertThat(response.getContent()).isEqualTo("Hello!");
        assertThat(response.getSenderId()).isEqualTo(userA.getId());
    }

    @Test
    void shouldRejectSendWhenTrustLevelTooLow() {
        connection = Connection.builder()
                .id(connId)
                .userA(userA)
                .userB(userB)
                .status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.DISCOVERED)
                .build();
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));

        MessageRequest req = new MessageRequest();
        req.setContent("Hello!");

        assertThatThrownBy(() -> messageService.send(connId, userA.getId(), MessageChannel.MAIN, req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Trust level too low");
    }

    @Test
    void shouldRejectNonParticipant() {
        UUID stranger = UUID.randomUUID();
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));

        MessageRequest req = new MessageRequest();
        req.setContent("Hello!");

        assertThatThrownBy(() -> messageService.send(connId, stranger, MessageChannel.MAIN, req))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void unreadConversationCount_countsConversationsInOneGroupedQuery() {
        Connection second = Connection.builder()
                .id(UUID.randomUUID()).userA(userA).userB(userB)
                .status(ConnectionStatus.ACTIVE).currentTrustLevel(TrustLevel.MESSAGING).build();
        when(connectionRepository.findAllByUser(userA.getId())).thenReturn(List.of(connection, second));
        // Only the conversations that have unread messages come back — one row each.
        when(messageRepository.countUnreadByConnectionIds(anyCollection(), eq(userA.getId()), eq(MessageChannel.MAIN)))
                .thenReturn(List.<Object[]>of(new Object[]{connId, 4L}));

        int count = messageService.unreadConversationCount(userA.getId());

        assertThat(count).isEqualTo(1);
        verify(messageRepository, never()).countByConnectionIdAndSenderIdNotAndSeenAtIsNull(any(), any());
    }

    @Test
    void markSeen_stampsTheConversationInOneBulkUpdate() {
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));

        messageService.markSeen(connId, userA.getId());

        verify(messageRepository).markSeenByConnectionId(eq(connId), eq(userA.getId()), any(LocalDateTime.class), eq(MessageChannel.MAIN));
        // The chat polls this every few seconds — it must never read the messages first.
        verify(messageRepository, never()).findByConnectionIdOrderByCreatedAtAsc(any(), any());
    }

    @Test
    void markSeen_rejectsNonParticipantBeforeTouchingAnyMessage() {
        UUID stranger = UUID.randomUUID();
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));

        assertThatThrownBy(() -> messageService.markSeen(connId, stranger))
                .isInstanceOf(IllegalStateException.class);

        verify(messageRepository, never()).markSeenByConnectionId(any(), any(), any(), any());
    }

    @Test
    void shouldReturnChatHistory() {
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));
        Message m = Message.builder()
                .id(UUID.randomUUID())
                .connection(connection)
                .sender(userA)
                .content("Hi")
                .type(MessageType.TEXT)
                .build();
        Page<Message> page = new PageImpl<>(List.of(m));
        when(messageRepository.findByConnectionIdAndChannelOrderByCreatedAtDesc(
                eq(connId), eq(MessageChannel.MAIN), any())).thenReturn(page);

        Page<MessageResponse> result = messageService.getHistory(
                connId, userA.getId(), MessageChannel.MAIN, PageRequest.of(0, 30));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getContent()).isEqualTo("Hi");
    }
}
