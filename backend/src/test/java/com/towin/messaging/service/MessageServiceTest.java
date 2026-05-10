package com.towin.messaging.service;

import com.towin.common.entity.User;
import com.towin.common.enums.MessageType;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock MessageRepository messageRepository;
    @Mock ConnectionRepository connectionRepository;
    @InjectMocks MessageService messageService;

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

        MessageResponse response = messageService.send(connId, userA.getId(), req);

        assertThat(response.getContent()).isEqualTo("Hello!");
        assertThat(response.getSenderId()).isEqualTo(userA.getId());
    }

    @Test
    void shouldRejectSendWhenTrustLevelTooLow() {
        connection = Connection.builder()
                .id(connId)
                .userA(userA)
                .userB(userB)
                .currentTrustLevel(TrustLevel.DISCOVERED)
                .build();
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));

        MessageRequest req = new MessageRequest();
        req.setContent("Hello!");

        assertThatThrownBy(() -> messageService.send(connId, userA.getId(), req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Trust level too low");
    }

    @Test
    void shouldRejectNonParticipant() {
        UUID stranger = UUID.randomUUID();
        when(connectionRepository.findById(connId)).thenReturn(Optional.of(connection));

        MessageRequest req = new MessageRequest();
        req.setContent("Hello!");

        assertThatThrownBy(() -> messageService.send(connId, stranger, req))
                .isInstanceOf(IllegalStateException.class);
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
        when(messageRepository.findByConnectionIdOrderByCreatedAtDesc(eq(connId), any())).thenReturn(page);

        Page<MessageResponse> result = messageService.getHistory(connId, userA.getId(), PageRequest.of(0, 30));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getContent()).isEqualTo("Hi");
    }
}
