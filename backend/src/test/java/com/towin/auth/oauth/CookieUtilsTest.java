package com.towin.auth.oauth;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.endpoint.PkceParameterNames;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CookieUtilsTest {

    @Test
    void shouldRoundTripEveryFieldOfTheAuthorizationRequest() {
        OAuth2AuthorizationRequest original = sampleAuthRequest();

        Cookie cookie = new Cookie(HttpCookieOAuth2AuthorizationRequestRepository.COOKIE_NAME,
                CookieUtils.serialize(original));
        OAuth2AuthorizationRequest restored = CookieUtils.deserialize(cookie, OAuth2AuthorizationRequest.class);

        assertThat(restored.getAuthorizationUri()).isEqualTo(original.getAuthorizationUri());
        assertThat(restored.getGrantType()).isEqualTo(original.getGrantType());
        assertThat(restored.getResponseType()).isEqualTo(original.getResponseType());
        assertThat(restored.getClientId()).isEqualTo(original.getClientId());
        assertThat(restored.getRedirectUri()).isEqualTo(original.getRedirectUri());
        assertThat(restored.getScopes()).isEqualTo(original.getScopes());
        assertThat(restored.getState()).isEqualTo(original.getState());
        assertThat(restored.getAdditionalParameters()).isEqualTo(original.getAdditionalParameters());
        assertThat(restored.getAttributes()).isEqualTo(original.getAttributes());
        // the registration id and the PKCE verifier live in the attributes — Google login breaks without them
        assertThat((String) restored.getAttribute(OAuth2ParameterNames.REGISTRATION_ID)).isEqualTo("google");
        assertThat((String) restored.getAttribute(PkceParameterNames.CODE_VERIFIER)).isEqualTo("verifier-abc");
        assertThat(restored.getAuthorizationRequestUri()).isEqualTo(original.getAuthorizationRequestUri());
    }

    @Test
    void shouldRejectHostileJavaSerializedCookiePayload() throws IOException {
        ExploitPayload.detonated = false;
        Cookie cookie = new Cookie(HttpCookieOAuth2AuthorizationRequestRepository.COOKIE_NAME,
                base64JavaSerialized(new ExploitPayload()));

        assertThatThrownBy(() -> CookieUtils.deserialize(cookie, OAuth2AuthorizationRequest.class))
                .isInstanceOf(RuntimeException.class);
        assertThat(ExploitPayload.detonated)
                .as("a client-supplied cookie must never be fed to Java deserialization")
                .isFalse();
    }

    @Test
    void shouldMarkCookieSecureWhenRequestIsSecure() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(true);
        MockHttpServletResponse response = new MockHttpServletResponse();

        CookieUtils.addCookie(request, response, HttpCookieOAuth2AuthorizationRequestRepository.COOKIE_NAME,
                "value", Duration.ofMinutes(3));

        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).contains("Secure");
    }

    @Test
    void shouldNotMarkCookieSecureOnPlainHttpSoLocalDevKeepsWorking() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(false);
        MockHttpServletResponse response = new MockHttpServletResponse();

        CookieUtils.addCookie(request, response, HttpCookieOAuth2AuthorizationRequestRepository.COOKIE_NAME,
                "value", Duration.ofMinutes(3));

        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).doesNotContain("Secure");
    }

    @Test
    void shouldMarkTheDeletionCookieSecureWhenRequestIsSecure() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSecure(true);
        request.setCookies(new Cookie(HttpCookieOAuth2AuthorizationRequestRepository.COOKIE_NAME, "value"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        CookieUtils.deleteCookie(request, response, HttpCookieOAuth2AuthorizationRequestRepository.COOKIE_NAME);

        assertThat(response.getHeader(HttpHeaders.SET_COOKIE)).contains("Secure");
    }

    private static OAuth2AuthorizationRequest sampleAuthRequest() {
        Map<String, Object> additionalParameters = new LinkedHashMap<>();
        additionalParameters.put("nonce", "nonce-123");
        additionalParameters.put("prompt", "consent");

        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put(OAuth2ParameterNames.REGISTRATION_ID, "google");
        attributes.put(PkceParameterNames.CODE_VERIFIER, "verifier-abc");

        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("client-id-123")
                .redirectUri("https://towin.app/login/oauth2/code/google")
                .scopes(new LinkedHashSet<>(Set.of("openid", "profile", "email")))
                .state("state-xyz")
                .additionalParameters(additionalParameters)
                .attributes(attributes)
                .build();
    }

    private static String base64JavaSerialized(Object object) throws IOException {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            oos.writeObject(object);
            oos.flush();
            return Base64.getUrlEncoder().encodeToString(baos.toByteArray());
        }
    }

    /** Stand-in for a deserialization gadget: readObject() has a side effect that must never fire. */
    static class ExploitPayload implements Serializable {
        private static final long serialVersionUID = 1L;
        static boolean detonated = false;

        private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
            in.defaultReadObject();
            detonated = true;
        }
    }
}
