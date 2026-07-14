package com.towin.auth.oauth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.jackson2.SecurityJackson2Modules;

import java.io.IOException;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

public abstract class CookieUtils {

    /**
     * Cookie values come straight from the client, so they are read with Jackson — never Java
     * serialization. Spring Security's modules install an allowlist-restricted default typing plus
     * the OAuth2 client mixins, so only the handful of types it knows about can ever be built.
     */
    private static final ObjectMapper MAPPER = buildMapper();

    private static ObjectMapper buildMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModules(SecurityJackson2Modules.getModules(CookieUtils.class.getClassLoader()));
        SecurityJackson2Modules.enableDefaultTyping(mapper);
        return mapper;
    }

    public static Optional<Cookie> getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (name.equals(c.getName())) return Optional.of(c);
            }
        }
        return Optional.empty();
    }

    /**
     * Secure is driven by the request's own scheme: HTTPS in prod (forward-headers-strategy: framework
     * makes isSecure() reflect the real client scheme behind Railway's edge), off for plain-HTTP localhost.
     */
    public static void addCookie(HttpServletRequest request, HttpServletResponse response,
                                 String name, String value, Duration maxAge) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .path("/")
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Lax")
                .maxAge(maxAge)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public static void deleteCookie(HttpServletRequest request, HttpServletResponse response, String name) {
        if (getCookie(request, name).isPresent()) {
            ResponseCookie cookie = ResponseCookie.from(name, "")
                    .path("/")
                    .httpOnly(true)
                    .secure(request.isSecure())
                    .sameSite("Lax")
                    .maxAge(Duration.ZERO)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        }
    }

    public static String serialize(Object object) {
        try {
            return Base64.getUrlEncoder().encodeToString(MAPPER.writeValueAsBytes(object));
        } catch (IOException e) {
            throw new RuntimeException("Cookie serialize failed", e);
        }
    }

    public static <T> T deserialize(Cookie cookie, Class<T> cls) {
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(cookie.getValue());
            return MAPPER.readValue(bytes, cls);
        } catch (IOException | IllegalArgumentException e) {
            throw new RuntimeException("Cookie deserialize failed", e);
        }
    }
}
