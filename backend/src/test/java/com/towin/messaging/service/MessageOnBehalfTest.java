package com.towin.messaging.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.DelegatedPower;
import com.towin.common.enums.MessageChannel;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.family.service.FamilyDelegationService;
import com.towin.family.service.FamilyStandingService;
import com.towin.messaging.dto.MessageRequest;
import com.towin.messaging.dto.MessageResponse;
import com.towin.messaging.entity.Message;
import com.towin.messaging.repository.MessageRepository;
import com.towin.profile.entity.ElderProfile;
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
 * Guardian mode, power 1: Sarah writes to her mother's helper for her.
 *
 * Margaret stays the sender, so the chat, its trust gate and its history are
 * exactly as they were; Sarah is recorded as the one who typed, so the helper
 * reads "Sarah, for Margaret" and never mistakes it for Margaret's own words.
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
    @Mock FamilyDelegationService familyDelegationService;
    @InjectMocks MessageService messageService;

    private User margaret;   // the parent, and the connection's elder seat
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
                .build();
    }

    private MessageRequest saying(String words) {
        MessageRequest req = new MessageRequest();
        req.setContent(words);
        return req;
    }

    @Test
    void delegatedFamilyMemberWritesAsTheParentAndIsNamedAsTheAuthor() {
        when(connectionRepository.findById(chatId)).thenReturn(Optional.of(chat));
        when(familyDelegationService.hasPower(sarah.getId(), margaret.getId(), DelegatedPower.MESSAGE_HELPERS))
                .thenReturn(true);
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(elderProfileRepository.findByUserId(sarah.getId()))
                .thenReturn(Optional.of(ElderProfile.builder().name("Sarah").build()));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = messageService.send(
                chatId, sarah.getId(), MessageChannel.MAIN, saying("Mum can't make Tuesday"));

        ArgumentCaptor<Message> saved = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(saved.capture());
        // The parent owns the message; the daughter is recorded as its author.
        assertThat(saved.getValue().getSender().getId()).isEqualTo(margaret.getId());
        assertThat(saved.getValue().getActedBy().getId()).isEqualTo(sarah.getId());
        assertThat(response.getSenderId()).isEqualTo(margaret.getId());
        assertThat(response.getActedByName()).isEqualTo("Sarah");
    }

    @Test
    void familyMemberWithoutThePowerIsStillShutOutOfTheParentsChat() {
        when(connectionRepository.findById(chatId)).thenReturn(Optional.of(chat));
        when(familyDelegationService.hasPower(any(), any(), any())).thenReturn(false);

        assertThatThrownBy(() -> messageService.send(
                chatId, sarah.getId(), MessageChannel.MAIN, saying("let me in")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Not a participant");
        verify(messageRepository, never()).save(any());
    }

    @Test
    void theParentsOwnMessagesCarryNoAuthorLabel() {
        when(connectionRepository.findById(chatId)).thenReturn(Optional.of(chat));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = messageService.send(
                chatId, margaret.getId(), MessageChannel.MAIN, saying("I'll be there"));

        ArgumentCaptor<Message> saved = ArgumentCaptor.forClass(Message.class);
        verify(messageRepository).save(saved.capture());
        assertThat(saved.getValue().getActedBy()).isNull();
        assertThat(response.getActedByName()).isNull();
        // A participant is only ever themselves — no delegation lookup is needed.
        verify(familyDelegationService, never()).hasPower(any(), any(), any());
    }

    @Test
    void thePowerIsRecheckedOnEveryMessageSoRevokingItStopsTheNextOne() {
        when(connectionRepository.findById(chatId)).thenReturn(Optional.of(chat));
        when(familyDelegationService.hasPower(sarah.getId(), margaret.getId(), DelegatedPower.MESSAGE_HELPERS))
                .thenReturn(true)      // granted when she sends the first
                .thenReturn(false);    // Margaret takes it back straight after
        when(userRepository.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        messageService.send(chatId, sarah.getId(), MessageChannel.MAIN, saying("first"));

        assertThatThrownBy(() -> messageService.send(
                chatId, sarah.getId(), MessageChannel.MAIN, saying("second")))
                .isInstanceOf(IllegalStateException.class);
        verify(messageRepository).save(any());  // only the first one landed
    }

    @Test
    void thePowerDoesNotReachTheFamilyUpdatesThread() {
        // MESSAGE_HELPERS is about the parent's private chats. The updates thread
        // has its own gate, and Sarah posts there as herself — being trusted to
        // speak for her mother must not silently rewrite who she is elsewhere.
        assertThatThrownBy(() -> messageService.send(
                chatId, sarah.getId(), MessageChannel.FAMILY_UPDATES, saying("hello all")))
                .isInstanceOf(RuntimeException.class);
        verify(familyDelegationService, never()).hasPower(any(), any(), any());
    }
}
