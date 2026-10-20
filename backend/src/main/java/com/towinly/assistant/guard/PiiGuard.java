package com.towinly.assistant.guard;

import java.util.regex.Pattern;

/**
 * Keeps phone numbers, email addresses and long digit runs (cards, accounts)
 * out of what leaves for the model. The helper never needs them, and a person
 * who types their own number into a chat box should not have it sent to a
 * third party. Short numbers people ask about (7 stages, 15 points, age 72)
 * are left alone.
 */
public final class PiiGuard {

    static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    /** Seven or more digits, with spaces, dots, dashes, parentheses or a leading plus between them. */
    static final Pattern LONG_NUMBER = Pattern.compile("(?:\\+?\\d[\\s().-]*){6,}\\d");

    private PiiGuard() {}

    public static String redact(String text) {
        if (text == null) return "";
        String out = EMAIL.matcher(text).replaceAll("[email]");
        return LONG_NUMBER.matcher(out).replaceAll("[number]");
    }

    /** True when the text still carries an email or a long number. */
    public static boolean containsContact(String text) {
        return text != null && (EMAIL.matcher(text).find() || LONG_NUMBER.matcher(text).find());
    }
}
