package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;

/**
 * The one place that decides what name we print for a person. Reviews, messages,
 * help requests, trust steps and family screens all show names in sentences like
 * "Sarah, writing for Margaret", and every one of them used to work the name out
 * on its own. Each copy ended the same way — fall back to the login handle — and
 * for accounts that sign in with their email address that quietly published a
 * person's email on a public profile page. One shared answer, so a fix here is a
 * fix everywhere. Static on purpose, matching {@link UserIdentifierResolver}:
 * callers already hold these repositories, so no extra bean wiring is needed.
 */
public final class DisplayNameResolver {

    /**
     * What we say when we know nothing about someone that is safe to print.
     * It has to be a real word, not an empty string: these names sit inside
     * sentences, and "{name}, writing for Margaret" with nothing in front of the
     * comma reads as a broken page rather than a missing name. Deliberately
     * neutral — the same helper names elders, helpers and family alike, so it
     * can't assume "a family member".
     */
    private static final String SOMEONE = "Someone";

    private DisplayNameResolver() {
    }

    /**
     * The person's own name: their elder profile name, then their helper profile
     * name, then the full name on their account, and only then a safe last
     * resort. Family should see "Margaret", never the login handle "elder".
     */
    public static String resolve(ElderProfileRepository elderProfiles,
                                 HelperProfileRepository helperProfiles,
                                 User user) {
        return elderProfiles.findByUserId(user.getId())
                .map(ElderProfile::getName)
                .filter(DisplayNameResolver::notBlank)
                .or(() -> helperProfiles.findByUserId(user.getId())
                        .map(HelperProfile::getName)
                        .filter(DisplayNameResolver::notBlank))
                .orElseGet(() -> fromUser(user));
    }

    /**
     * The same answer for callers with no profile lookup to hand — the full name
     * on the account, then a safe last resort. Used where the person has no
     * profile to consult anyway, such as SOS alerts and family alerts.
     */
    public static String fromUser(User user) {
        if (notBlank(user.getFullName())) return user.getFullName();
        return safeLastResort(user.getUsername());
    }

    /**
     * The login handle, but only when it isn't a way to contact this person.
     * People sign in with an email address or a phone number, and printing either
     * one on a public page hands a stranger a direct line to them. So we show a
     * plain handle as-is, take only the front of an email address when it reads
     * like a name, and otherwise say nothing more than "Someone".
     */
    private static String safeLastResort(String username) {
        if (!notBlank(username)) return SOMEONE;
        String handle = username.trim();

        // A phone number is a contact detail and never a name. Anything with no
        // letter at all is only digits and punctuation, so there is no name
        // hiding in it to show.
        if (handle.startsWith("+") || handle.chars().noneMatch(Character::isLetter)) return SOMEONE;

        // An ordinary handle like "margaret_h" — nobody can write to that.
        int at = handle.indexOf('@');
        if (at < 0) return handle;

        // An email address. We keep only the part before the '@', so what's left
        // is no longer somewhere you can send mail, and we use it only when it
        // reads like a name: letters and simple separators. Digits in a handle
        // usually carry a birth year or a piece of a phone number, and those are
        // exactly the details we're trying not to print.
        String words = handle.substring(0, at).replaceAll("[._+-]+", " ").trim();
        boolean readsLikeAName = words.length() >= 2
                && words.chars().allMatch(c -> Character.isLetter(c) || c == ' ');
        return readsLikeAName ? titleCase(words) : SOMEONE;
    }

    /** "demo sarah" → "Demo Sarah", so a handle reads as a name in a sentence. */
    private static String titleCase(String words) {
        StringBuilder out = new StringBuilder(words.length());
        boolean startOfWord = true;
        for (char c : words.toCharArray()) {
            out.append(startOfWord ? Character.toUpperCase(c) : Character.toLowerCase(c));
            startOfWord = c == ' ';
        }
        return out.toString();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
