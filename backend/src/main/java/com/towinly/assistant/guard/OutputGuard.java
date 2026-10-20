package com.towinly.assistant.guard;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The last check before a reply reaches a person. A reply that asks for a
 * secret, tells someone to send money, leaks a prompt section, or invents a
 * contact detail (the helper knows none) is replaced by the fallback sentence
 * upstream; this class only says why.
 */
public final class OutputGuard {

    private static final Pattern ASKS_FOR_CREDENTIALS = Pattern.compile(
            "\\b(type|enter|send|give|tell|share|provide|confirm|what is|what's)\\b[^.?!]{0,40}?"
            + "\\b(password|pin|card number|bank (account|details)|verification code|one[- ]time code|security code)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SEND_MONEY = Pattern.compile(
            "\\b(send|transfer|wire|give)\\b[^.?!]{0,40}?\\b(money|cash|dollars|euros|rupees|e-?transfer)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern NEGATED = Pattern.compile("\\b(never|not|don't|do not|no one|nobody|won't)\\b[^.?!]{0,30}$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PROMPT_MARKER = Pattern.compile("===\\s*[A-Z]|\\bWHO YOU ARE\\b|\\bKNOWLEDGE BASE\\b");

    private OutputGuard() {}

    /** Empty when the reply may be shown; otherwise a short reason for the log. */
    public static Optional<String> problem(String reply) {
        if (reply == null || reply.isBlank()) return Optional.empty();
        if (ASKS_FOR_CREDENTIALS.matcher(reply).find()) return Optional.of("asks for credentials");
        Matcher money = SEND_MONEY.matcher(reply);
        while (money.find()) {
            String before = reply.substring(Math.max(0, money.start() - 30), money.start()).toLowerCase(Locale.ROOT);
            if (!NEGATED.matcher(before).find()) return Optional.of("tells someone to send money");
        }
        if (PROMPT_MARKER.matcher(reply).find()) return Optional.of("leaks a prompt section");
        if (PiiGuard.containsContact(reply)) return Optional.of("contains a contact detail");
        return Optional.empty();
    }
}
