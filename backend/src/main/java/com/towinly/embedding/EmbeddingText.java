package com.towinly.embedding;

import com.towinly.need.entity.Need;
import com.towinly.profile.entity.ElderProfile;
import com.towinly.profile.entity.HelperProfile;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The words that get embedded for a person or a request: one short paragraph,
 * same shape every time, so two profiles that say the same thing land near each
 * other. Location is left out on purpose; distance is ranked separately.
 */
public final class EmbeddingText {

    private EmbeddingText() {}

    public static String forElder(ElderProfile p) {
        List<String> parts = new ArrayList<>();
        parts.add("Elder.");
        add(parts, "About", p.getBio());
        add(parts, "Interests", join(p.getInterests()));
        add(parts, "Languages", join(p.getLanguages()));
        add(parts, "Occupation", p.getOccupation());
        return String.join(" ", parts);
    }

    public static String forHelper(HelperProfile p) {
        List<String> parts = new ArrayList<>();
        parts.add("Helper.");
        add(parts, "About", p.getBio());
        add(parts, "Can help with", join(p.getSkillsOffered()));
        add(parts, "Hobbies", join(p.getHobbies()));
        add(parts, "Languages", join(p.getLanguages()));
        add(parts, "Occupation", p.getOccupation());
        return String.join(" ", parts);
    }

    public static String forNeed(Need n) {
        List<String> parts = new ArrayList<>();
        parts.add("Help request: " + clean(n.getTitle()) + ".");
        if (!clean(n.getDescription()).isEmpty()) parts.add(sentence(n.getDescription()));
        if (n.getCategory() != null) parts.add("Category: " + n.getCategory().name().toLowerCase(Locale.ROOT) + ".");
        return String.join(" ", parts);
    }

    private static void add(List<String> parts, String label, String value) {
        String v = clean(value);
        if (!v.isEmpty()) parts.add(label + ": " + sentence(v));
    }

    private static String join(String[] values) {
        if (values == null) return "";
        List<String> kept = new ArrayList<>();
        for (String v : values) if (!clean(v).isEmpty()) kept.add(clean(v));
        return String.join(", ", kept);
    }

    private static String clean(String s) {
        return s == null ? "" : s.trim();
    }

    /** Ends with one full stop, whatever the writer typed. */
    private static String sentence(String s) {
        String t = clean(s);
        while (t.endsWith(".")) t = t.substring(0, t.length() - 1).trim();
        return t + ".";
    }
}
