package com.towinly.assistant.evals;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scores one reply against one case. Pure: the same inputs always give the same
 * failures, and an empty list means the case passed. Rules are cheap string
 * checks on purpose; a two-to-five-sentence helper does not need a model to
 * judge it, and a model judge would cost tokens and drift.
 */
final class EvalScorer {

    static final int DEFAULT_MAX_SENTENCES = 8;

    private static final Pattern SENTENCE_END = Pattern.compile("[.!?]+");
    private static final List<String> FORMATTING = List.of("**", "##", "```");

    private EvalScorer() {}

    static List<String> score(EvalCase c, String reply) {
        List<String> failures = new ArrayList<>();
        if (reply == null || reply.isBlank()) {
            failures.add("empty reply");
            return failures;
        }
        String lower = reply.toLowerCase(Locale.ROOT);

        if (FORMATTING.stream().anyMatch(reply::contains)) {
            failures.add("formatting symbols");
        }
        if (c.mustIncludeAny() != null && !c.mustIncludeAny().isEmpty()
                && c.mustIncludeAny().stream().noneMatch(s -> lower.contains(s.toLowerCase(Locale.ROOT)))) {
            failures.add("missing any of " + c.mustIncludeAny());
        }
        if (c.mustIncludeAll() != null) {
            for (String s : c.mustIncludeAll()) {
                if (!lower.contains(s.toLowerCase(Locale.ROOT))) failures.add("missing: " + s);
            }
        }
        if (c.mustNotInclude() != null) {
            for (String s : c.mustNotInclude()) {
                if (lower.contains(s.toLowerCase(Locale.ROOT))) failures.add("contains: " + s);
            }
        }
        int max = c.maxSentences() != null ? c.maxSentences() : DEFAULT_MAX_SENTENCES;
        int sentences = countSentences(reply);
        if (sentences > max) {
            failures.add(sentences + " sentences, max " + max);
        }
        if ("tamil".equals(c.script()) && tamilShare(reply) < 0.5) {
            failures.add("not in Tamil script");
        }
        if ("latin".equals(c.script()) && tamilShare(reply) > 0.0) {
            failures.add("Tamil letters in a Latin reply");
        }
        return failures;
    }

    private static int countSentences(String text) {
        Matcher m = SENTENCE_END.matcher(text);
        int n = 0;
        while (m.find()) n++;
        return n;
    }

    /** Share of the letters (digits and punctuation ignored) that are Tamil. 0 when there are no letters. */
    static double tamilShare(String text) {
        int letters = 0;
        int tamil = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (!Character.isLetter(ch)) continue;
            letters++;
            if (Character.UnicodeBlock.of(ch) == Character.UnicodeBlock.TAMIL) tamil++;
        }
        return letters == 0 ? 0.0 : (double) tamil / letters;
    }
}
