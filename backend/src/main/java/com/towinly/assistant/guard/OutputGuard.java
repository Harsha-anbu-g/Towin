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
    private static final Pattern NEGATED = Pattern.compile("\\b(never|not|don't|can't|cannot|do not|no one|nobody|won't)\\b[^.?!]{0,30}$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PROMPT_MARKER = Pattern.compile("===\\s*[A-Z]|\\bWHO YOU ARE\\b|\\bKNOWLEDGE BASE\\b");

    /**
     * The one address the helper may quote: the knowledge base tells it to point
     * people with a delete or export request here, so it is published, not invented.
     */
    static final String TEAM_EMAIL = "agharsha.anbu@gmail.com";

    private OutputGuard() {}

    /** Empty when the reply may be shown; otherwise a short reason for the log. */
    public static Optional<String> problem(String rawReply) {
        if (rawReply == null || rawReply.isBlank()) return Optional.empty();
        // OpenAI's models write curly apostrophes (don’t); the negation check reads straight ones.
        String reply = rawReply.replace('\u2019', '\'').replace('\u2018', '\'').replace('\u02BC', '\'');
        if (isAsked(ASKS_FOR_CREDENTIALS, reply)) return Optional.of("asks for credentials");
        if (isAsked(SEND_MONEY, reply)) return Optional.of("tells someone to send money");
        if (PROMPT_MARKER.matcher(reply).find()) return Optional.of("leaks a prompt section");
        if (PiiGuard.containsContact(reply.replace(TEAM_EMAIL, ""))) return Optional.of("contains a contact detail");
        return Optional.empty();
    }

    /** True when the pattern matches somewhere it is not negated ("never share your password" is fine advice). */
    private static boolean isAsked(Pattern pattern, String reply) {
        Matcher m = pattern.matcher(reply);
        while (m.find()) {
            String before = reply.substring(Math.max(0, m.start() - 30), m.start()).toLowerCase(Locale.ROOT);
            if (!NEGATED.matcher(before).find()) return true;
        }
        return false;
    }
}
