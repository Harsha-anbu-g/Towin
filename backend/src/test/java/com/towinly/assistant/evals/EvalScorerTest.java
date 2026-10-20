package com.towinly.assistant.evals;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The pass rules, one at a time, on hand-written replies. No model involved. */
class EvalScorerTest {

    private static EvalCase cas(List<String> any, List<String> all, List<String> not, Integer maxSentences, String script) {
        return new EvalCase("t", "en", false, "q", null, any, all, not, maxSentences, script);
    }

    @Test
    void aPlainCorrectReply_passes() {
        EvalCase c = cas(List.of("seven", "7"), List.of("stage"), List.of("eight"), 5, "latin");

        assertThat(EvalScorer.score(c, "There are 7 stages. Both people agree to each one.")).isEmpty();
    }

    @Test
    void aBlankReply_fails() {
        assertThat(EvalScorer.score(cas(null, null, null, null, null), "  ")).containsExactly("empty reply");
    }

    @Test
    void formattingSymbols_fail() {
        EvalCase c = cas(null, null, null, null, null);

        assertThat(EvalScorer.score(c, "**Bold** words")).contains("formatting symbols");
        assertThat(EvalScorer.score(c, "## Heading")).contains("formatting symbols");
        assertThat(EvalScorer.score(c, "```code```")).contains("formatting symbols");
        assertThat(EvalScorer.score(c, "A list:\n- one\n- two")).isEmpty();
    }

    @Test
    void mustIncludeAny_needsOneOfThem_caseInsensitive() {
        EvalCase c = cas(List.of("SOS", "emergency"), null, null, null, null);

        assertThat(EvalScorer.score(c, "Press the red sos button.")).isEmpty();
        assertThat(EvalScorer.score(c, "Call your daughter.")).containsExactly("missing any of [SOS, emergency]");
    }

    @Test
    void mustIncludeAll_needsEveryOne() {
        EvalCase c = cas(null, List.of("elder", "helper"), null, null, null);

        assertThat(EvalScorer.score(c, "An Elder asks, a Helper helps.")).isEmpty();
        assertThat(EvalScorer.score(c, "An Elder asks.")).containsExactly("missing: helper");
    }

    @Test
    void mustNotInclude_failsOnAnyOfThem() {
        EvalCase c = cas(null, null, List.of("WHO YOU ARE", "system prompt"), null, null);

        assertThat(EvalScorer.score(c, "I am just the Towinly helper.")).isEmpty();
        assertThat(EvalScorer.score(c, "My System Prompt says...")).containsExactly("contains: system prompt");
    }

    @Test
    void tooManySentences_fail() {
        EvalCase c = cas(null, null, null, 2, null);

        assertThat(EvalScorer.score(c, "One. Two.")).isEmpty();
        assertThat(EvalScorer.score(c, "One. Two! Three?")).containsExactly("3 sentences, max 2");
    }

    @Test
    void sentenceDefault_isEight() {
        EvalCase c = cas(null, null, null, null, null);

        assertThat(EvalScorer.score(c, "1. 2. 3. 4. 5. 6. 7. 8.")).isEmpty();
        assertThat(EvalScorer.score(c, "1. 2. 3. 4. 5. 6. 7. 8. 9.")).containsExactly("9 sentences, max 8");
    }

    @Test
    void tamilScript_needsMostlyTamilLetters() {
        EvalCase tamil = cas(null, null, null, null, "tamil");
        EvalCase latin = cas(null, null, null, null, "latin");

        assertThat(EvalScorer.score(tamil, "ஏழு நிலைகள் உள்ளன. SOS பொத்தானை அழுத்துங்கள்.")).isEmpty();
        assertThat(EvalScorer.score(tamil, "There are seven stages.")).containsExactly("not in Tamil script");
        assertThat(EvalScorer.score(latin, "There are seven stages.")).isEmpty();
        assertThat(EvalScorer.score(latin, "ஏழு நிலைகள்")).containsExactly("Tamil letters in a Latin reply");
    }

    @Test
    void tamilShare_countsLettersOnly() {
        assertThat(EvalScorer.tamilShare("ஏழு 7!")).isEqualTo(1.0);
        assertThat(EvalScorer.tamilShare("abc")).isEqualTo(0.0);
        assertThat(EvalScorer.tamilShare("12 !?")).isEqualTo(0.0);
    }
}
