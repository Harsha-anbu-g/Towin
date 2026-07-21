package com.towin.messaging.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.MessageChannel;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.family.service.FamilyStandingService;
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

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The parent's private chat belongs to the parent alone.
 *
 * On-behalf messaging (guardian mode, "write to your helpers for you") was removed
 * 2026-07-21: a family member can no longer write inside a parent's private chat in
 * the parent's name. A family member reaches a helper only through their own direct
 * chat or the shared group thread. This test guards that invariant — a non-participant
 * is shut out, and the parent's own words carry no author label.
 */
@ExtendWith(MockitoExtension.class)
class MessageOnBehalfTest {

    @Mock MessageRepository messageRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock S3Service s3Service;
    @Mock FamilyStandingService familyStandingService;
    @InjectMocks MessageService messageService;

    private User margaret;   // the parent, on the connection
    private User helper;     // the helper she is chatting with
    private User sarah;      // her daughter, not on the connection at all
    private Connection chat;
    private UUID chatId;

    @BeforeEach
    void setUp() {
        margaret = User.builder().id(UUID.randomUUID()).username("margaret").build();
        helper = User.builder().id(UUID.randomUUID()).username("helper").build();
        sarah = User.builder().id(UUID.randomUUID()).username("sarah").build();
        chatId = UUID.randomUUID();
        chat = Connection.builder()
                .id(chatId)
                .userA(margaret)
                .userB(helper)
                .status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.MESSAGING)
                .sharedWithFamily(true)   // Margaret is Watching this chat
                .build();
    }

    private MessageRequest saying(String words) {
        MessageRequest req = new MessageRequest();
        req.setContent(words);
        return req;
    }

    @Test
    void aFamilyMemberCanNeverWriteInsideTheParentsPrivateChat() {
        when(connectionRepository.findById(chatId)).thenReturn(Optional.of(chat));

        assertThatThrownBy(() -> messageService.send(
                chatId, sarah.getId(), MessageChannel.MAIN, saying("let me in")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Not a participant");
        verify(messageRepository, never()).save(any());
    }

    @Test
    void theParentWritesInHerOwnChatAndTheMessageCarriesNoAuthorLabel() {
        when(connectionRepository.findById(chatId)).thenReturn(Optional.of(chat));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = messageService.send(
                chatId, margaret.getId(), MessageChannel.MAIN, saying("I'll be there"));

        ArgumentCaptor<Message> saved = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(saved.capture());
        assertThat(saved.getValue().getSender().getId()).isEqualTo(margaret.getId());
        assertThat(saved.getValue().getActedBy()).isNull();
        assertThat(response.getActedByName()).isNull();
    }
}
