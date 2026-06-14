package com.towin.auth.oauth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

import java.io.*;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;

public abstract class CookieUtils {

    public static Optional<Cookie> getCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if (name.equals(c.getName())) return Optional.of(c);
            }
        }
        return Optional.empty();
    }

    public static void addCookie(HttpServletResponse response, String name, String value, Duration maxAge) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .path("/")
                .httpOnly(true)
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
                    .sameSite("Lax")
                    .maxAge(Duration.ZERO)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        }
    }

    public static String serialize(Object object) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            oos.writeObject(object);
            return Base64.getUrlEncoder().encodeToString(baos.toByteArray());
        } catch (IOException e) {
            throw new RuntimeException("Cookie serialize failed", e);
        }
    }

    public static <T> T deserialize(Cookie cookie, Class<T> cls) {
        try {
            byte[] bytes = Base64.getUrlDecoder().decode(cookie.getValue());
            try (ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(bytes))) {
                return cls.cast(ois.readObject());
            }
        } catch (IOException | ClassNotFoundException e) {
            throw new RuntimeException("Cookie deserialize failed", e);
        }
    }
}
