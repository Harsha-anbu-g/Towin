package com.towinly.assistant.guard;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** What leaves for the model carries no phone numbers, emails or long digit runs. */
class PiiGuardTest {

    @Test
    void emailsAndPhoneNumbers_areReplaced() {
        assertThat(PiiGuard.redact("Call me on +1 (514) 555-0199 or write to mary.smith@example.com please"))
                .isEqualTo("Call me on [number] or write to [email] please");
        assertThat(PiiGuard.redact("my card is 4111 1111 1111 1111")).isEqualTo("my card is [number]");
    }

    @Test
    void shortNumbersPeopleAskAbout_survive() {
        assertThat(PiiGuard.redact("Are there 7 stages and 15 points? I am 72.")).isEqualTo("Are there 7 stages and 15 points? I am 72.");
    }

    @Test
    void nullIsEmpty() {
        assertThat(PiiGuard.redact(null)).isEmpty();
    }
}
