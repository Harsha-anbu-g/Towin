package com.towinly.reunion.service;

import java.util.regex.Pattern;

/**
 * The one safety rule a reunion enforces on its words: nobody asks a guest for
 * money, and no money channel is named. "An old classmate who needs money" is
 * the scam this feature must never open a door for, so a note that reads like
 * a money ask is refused outright, not warned about (HCI rule 5).
 *
 * The list is short on purpose: money verbs with "money", the common transfer
 * channels in Canada and India, and the two direct asks. Word boundaries keep
 * "stupid" from matching "upi" and "accountant" from matching "account number".
 */
public final class ReunionText {

    public static final String MONEY_REFUSED =
            "A reunion note cannot ask for money or name a bank, card or payment app. Leave money out and try again.";

    private static final Pattern MONEY_ASK = Pattern.compile(
            "\\b(send (me |us )?money|transfer money|wire money|e-?transfer|interac|wire transfer"
            + "|bank account|account number|gift cards?|upi|paytm|gpay|google pay|phonepe"
            + "|western union|pay me|pay us|lend me)\\b",
            Pattern.CASE_INSENSITIVE);

    private ReunionText() {}

    /** Throws IllegalArgumentException (a 400) when the text reads as a money ask. Null and blank pass. */
    public static void rejectMoneyAsk(String text) {
        if (text == null || text.isBlank()) return;
        if (MONEY_ASK.matcher(text).find()) {
            throw new IllegalArgumentException(MONEY_REFUSED);
        }
    }

    /** Every free-text field on a plan, in one call. */
    public static void rejectMoneyAsk(String... texts) {
        for (String t : texts) rejectMoneyAsk(t);
    }
}
