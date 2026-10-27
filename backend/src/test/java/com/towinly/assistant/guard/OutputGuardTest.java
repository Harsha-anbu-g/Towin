package com.towinly.assistant.guard;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** A reply that asks for secrets, money, or leaks the prompt never reaches a person. */
class OutputGuardTest {

    @Test
    void aKindAnswer_passes() {
        assertThat(OutputGuard.problem("There are 7 stages. Both people agree to each one.")).isEmpty();
        assertThat(OutputGuard.problem("Towinly will never ask for your password. If someone does, use Report.")).isEmpty();
    }

    @Test
    void aRefusalWithCurlyApostrophes_passes() {
        assertThat(OutputGuard.problem("Please don\u2019t send the money. Towinly does not ask for it in chat.")).isEmpty();
        assertThat(OutputGuard.problem("I can\u2019t see or tell you your password. Tap Forgot password on the login page.")).isEmpty();
        assertThat(OutputGuard.problem("Never share your password with anyone.")).isEmpty();
    }

    @Test
    void theTeamAddress_mayBeQuoted_butNoOtherAddress() {
        assertThat(OutputGuard.problem("Please email " + OutputGuard.TEAM_EMAIL + " and ask.")).isEmpty();
        assertThat(OutputGuard.problem("Please email rita@example.com and ask.").orElse("")).contains("contact");
        assertThat(OutputGuard.problem("Email " + OutputGuard.TEAM_EMAIL + " or rita@example.com.").orElse("")).contains("contact");
    }

    @Test
    void theTeamAddress_isTheOneTheKnowledgeBasePublishes() throws Exception {
        try (var in = OutputGuard.class.getResourceAsStream("/assistant/knowledge.md")) {
            assertThat(new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)).contains(OutputGuard.TEAM_EMAIL);
        }
    }

    @Test
    void askingForSecrets_isCaught() {
        assertThat(OutputGuard.problem("Please type your password here so I can check.").orElse("")).contains("credentials");
        assertThat(OutputGuard.problem("Give me the verification code you received.").orElse("")).contains("credentials");
        assertThat(OutputGuard.problem("What is your card number?").orElse("")).contains("credentials");
    }

    @Test
    void tellingSomeoneToSendMoney_isCaught() {
        assertThat(OutputGuard.problem("You should send money to your helper now.").orElse("")).contains("money");
        assertThat(OutputGuard.problem("Please send her the money today.").orElse("")).contains("money");
    }

    @Test
    void leakingThePrompt_orInventingContactDetails_isCaught() {
        assertThat(OutputGuard.problem("=== TOWINLY KNOWLEDGE BASE === says so").orElse("")).contains("prompt");
        assertThat(OutputGuard.problem("Call Rita on 514-555-0100.").orElse("")).contains("contact");
        assertThat(OutputGuard.problem("Email rita@example.com.").orElse("")).contains("contact");
    }
}
