package com.towin.messaging.entity;

import com.towin.common.enums.MessageChannel;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * US-001 (family Step 3): messages carry a channel so family updates can live
 * beside the private chat. MAIN must stay the default everywhere so existing
 * chat behavior is unchanged.
 */
class MessageChannelTest {

    @Test
    void channelEnumHasExactlyMainAndFamilyUpdates() {
        assertThat(MessageChannel.values())
                .containsExactly(MessageChannel.MAIN, MessageChannel.FAMILY_UPDATES);
    }

    @Test
    void newMessageDefaultsToMainChannel() {
        Message message = Message.builder().content("hello").build();
        assertThat(message.getChannel()).isEqualTo(MessageChannel.MAIN);
    }

    @Test
    void channelCanBeSetToFamilyUpdates() {
        Message message = Message.builder()
                .content("We did the shopping today.")
                .channel(MessageChannel.FAMILY_UPDATES)
                .build();
        assertThat(message.getChannel()).isEqualTo(MessageChannel.FAMILY_UPDATES);
    }
}
