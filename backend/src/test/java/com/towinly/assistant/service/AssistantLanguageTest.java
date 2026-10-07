package com.towinly.assistant.service;

import com.towinly.assistant.dto.ChatRequest;
import com.towinly.common.service.TrustScoreService;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.profile.service.ProfileService;
import com.towinly.streak.service.StreakService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The tortoise answers in the language the person chose on the site, and the
 * replies Towinly writes itself (assistant off, call failed) are in it too.
 */
class AssistantLanguageTest {

    private GroqClient groq;
    private AssistantService service;

    @BeforeEach
    void setUp() {
        groq = mock(GroqClient.class);
        when(groq.isConfigured()).thenReturn(true);
        service = new AssistantService(
                groq,
                mock(ProfileService.class),
                mock(StreakService.class),
                mock(ConnectionRepository.class),
                mock(NeedRepository.class),
                mock(TrustScoreService.class));
    }

    private static ChatRequest ask(String message) {
        ChatRequest r = new ChatRequest();
        r.setMessage(message);
        return r;
    }

    private String systemPromptFor(String language) {
        when(groq.complete(anyString(), any())).thenReturn(Optional.of("ok"));
        service.answer(ask("How does the Trust Journey work?"), null, language);
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(groq).complete(prompt.capture(), any());
        return prompt.getValue();
    }

    @Test
    void readsTheChosenLanguageFromAcceptLanguage() {
        assertThat(AssistantService.languageOf("fr")).isEqualTo("fr");
        assertThat(AssistantService.languageOf("fr-CA,fr;q=0.9,en;q=0.8")).isEqualTo("fr");
        assertThat(AssistantService.languageOf("ta")).isEqualTo("ta");
        assertThat(AssistantService.languageOf("en-US")).isEqualTo("en");
        assertThat(AssistantService.languageOf("de-DE")).isEqualTo("en");
        assertThat(AssistantService.languageOf(null)).isEqualTo("en");
    }

    @Test
    void asksTheModelToReplyInFrenchForAFrenchReader() {
        assertThat(systemPromptFor("fr")).contains("Reply in simple, warm French");
    }

    @Test
    void asksTheModelToReplyInTamilForATamilReader() {
        assertThat(systemPromptFor("ta")).contains("Reply in simple, warm, formal Tamil");
    }

    @Test
    void anUnknownLanguageIsTreatedAsEnglish() {
        assertThat(systemPromptFor("xx")).contains("Reply in simple English.");
    }

    @Test
    void theFailureReplyIsInTheReadersLanguage() {
        when(groq.complete(anyString(), any())).thenReturn(Optional.empty());
        assertThat(service.answer(ask("Hello"), null, "fr")).startsWith("Désolée");
        assertThat(service.answer(ask("Hello"), null, "ta")).startsWith("மன்னிக்கவும்");
        assertThat(service.answer(ask("Hello"), null, "en")).startsWith("Sorry");
    }

    @Test
    void theSwitchedOffReplyIsInTheReadersLanguage() {
        when(groq.isConfigured()).thenReturn(false);
        assertThat(service.answer(ask("Hello"), null, "fr")).contains("Comment ça marche");
    }

    @Test
    void retriesOnlyFailuresThatMayClearOnTheirOwn() {
        assertThat(GroqClient.isTransient(HttpClientErrorException.create(
                HttpStatus.TOO_MANY_REQUESTS, "", null, null, null))).isTrue();
        assertThat(GroqClient.isTransient(HttpServerErrorException.create(
                HttpStatus.BAD_GATEWAY, "", null, null, null))).isTrue();
        assertThat(GroqClient.isTransient(new ResourceAccessException("timed out"))).isTrue();
        assertThat(GroqClient.isTransient(HttpClientErrorException.create(
                HttpStatus.UNAUTHORIZED, "", null, null, null))).isFalse();
        assertThat(GroqClient.isTransient(HttpClientErrorException.create(
                HttpStatus.BAD_REQUEST, "", null, null, null))).isFalse();
    }
}
