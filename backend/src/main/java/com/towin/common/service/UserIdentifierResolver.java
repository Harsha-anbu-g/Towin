package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;

import java.util.Optional;

/**
 * Resolves a user by the same exact identifier rules the login form uses:
 * email (contains @), phone (digits, normalized), otherwise username.
 * Extracted from AuthService so features like family requests reuse the
 * login lookup semantics instead of re-implementing them. Static on purpose —
 * callers already hold a UserRepository, so no extra bean wiring is needed.
 */
public final class UserIdentifierResolver {

    private UserIdentifierResolver() {
    }

    public static Optional<User> resolve(UserRepository userRepository, String identifier) {
        if (identifier.contains("@")) {
            return userRepository.findByEmail(identifier);
        }
        // Phone numbers may be typed with spaces, dashes, or parens — strip them so the
        // value matches how it was stored at registration. Phone verification is a trust
        // signal, not an auth gate: the password is what proves identity, so an account
        // can sign in by phone before its number is OTP-verified.
        String phone = identifier.replaceAll("[\\s()-]", "");
        if (phone.startsWith("+") || phone.matches("\\d{10,15}")) {
            return userRepository.findByPhone(phone);
        }
        return userRepository.findByUsername(identifier);
    }
}
