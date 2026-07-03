package com.towin.auth.security;

import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Password rules applied whenever a password is *set* — signup, reset, and change.
 * Existing users are never re-checked; their current password keeps working until
 * they choose to change it.
 *
 * <p>Deliberately gentle for an older audience: we keep the 8-character minimum and
 * do NOT force uppercase/symbol/number combinations (those push people to reuse or
 * write down passwords). The high-value guard is simply rejecting the handful of
 * passwords attackers try first, plus anything equal to the person's own name/email.
 */
@Component
public class PasswordPolicy {

    private static final int MIN_LENGTH = 8;

    // The passwords credential-stuffing tools try first (only ones >= 8 chars need
    // listing, since shorter is already blocked by the length rule). Lowercase.
    private static final Set<String> COMMON = Set.of(
            "12345678", "123456789", "1234567890", "password", "password1", "password123",
            "passw0rd", "p@ssw0rd", "qwertyui", "qwertyuiop", "qwerty123", "asdfghjkl",
            "11111111", "00000000", "12341234", "1q2w3e4r", "1qaz2wsx", "zxcvbnm1",
            "iloveyou", "abc12345", "admin123", "welcome1", "welcome123", "changeme",
            "letmein1", "trustno1", "sunshine", "princess", "football", "baseball",
            "superman", "batman12", "monkey12", "dragon12", "default1",
            "towin123", "towin1234", "towinpass"
    );

    /**
     * @throws IllegalArgumentException with a user-safe message if the password is too
     *         weak. {@code username}/{@code email} may be null (e.g. reset flow).
     */
    public void validate(String password, String username, String email) {
        if (password == null || password.length() < MIN_LENGTH) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
        String pw = password.toLowerCase();
        if (COMMON.contains(pw)) {
            throw new IllegalArgumentException("Please choose a stronger password — that one is too common.");
        }
        if (username != null && !username.isBlank() && pw.equals(username.toLowerCase())) {
            throw new IllegalArgumentException("Please choose a stronger password — it can't be your username.");
        }
        if (email != null && email.contains("@")) {
            String local = email.substring(0, email.indexOf('@')).toLowerCase();
            if (local.length() >= 4 && pw.equals(local)) {
                throw new IllegalArgumentException("Please choose a stronger password — it can't be your email.");
            }
        }
    }
}
