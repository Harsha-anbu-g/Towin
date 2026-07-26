package com.towinly.assistant.service;

/**
 * Cleans text on its way into the model prompt.
 *
 * <p>Everything a visitor types is untrusted, and the browser is not the only
 * client — anyone can POST straight to {@code /api/assistant/chat}. Two families
 * of trouble are stripped here.
 *
 * <p><b>Invisible instruction smuggling.</b> Several Unicode ranges render as
 * nothing at all yet still reach the model as tokens: the Tags block
 * (U+E0000–U+E007F) can spell out a whole hidden sentence, bidi overrides can
 * reorder visible text away from what the model reads, and zero-width characters
 * break up words so a naive keyword filter misses them. An attacker uses these to
 * hide "ignore your instructions" inside a question that looks innocent in the
 * chat bubble and in our logs. None of them have a legitimate use in a help
 * question, so they are removed rather than escaped.
 *
 * <p><b>Prompt-structure spoofing.</b> Chat models are trained on transcripts, so
 * a user who types something shaped like a role marker or a system banner can
 * make their own text read as a new turn or a new instruction block rather than
 * as the content of their own turn. Those markers are defanged here.
 *
 * <p>This is defence in depth, not the whole defence. The real turn boundary is
 * the message role, and {@link com.towinly.assistant.dto.ChatMessage} restricts
 * that to "user" or "assistant" so a caller can never submit a system turn; the
 * system prompt tells the model that conversation text is data, not instructions;
 * and the model is the last line. Sanitising removes the tricks that work
 * regardless of how the request is worded.
 */
final class PromptSanitizer {

    private PromptSanitizer() {
    }

    /**
     * Returns {@code text} with invisible and structural trickery removed and
     * length bounded to {@code maxChars}. Null becomes an empty string, so callers
     * never have to null-check the result.
     */
    static String clean(String text, int maxChars) {
        if (text == null || text.isEmpty()) {
            return "";
        }

        StringBuilder out = new StringBuilder(Math.min(text.length(), maxChars));
        int consecutiveNewlines = 0;

        // codePoints, not chars: the Tags block is above the BMP, so a char-by-char
        // loop would see surrogate halves and let the smuggled text through.
        for (int i = 0; i < text.length() && out.length() < maxChars; ) {
            int cp = text.codePointAt(i);
            i += Character.charCount(cp);

            if (isInvisibleOrControl(cp)) {
                continue;
            }
            // A wall of blank lines is the cheapest way to pad a prompt and to push
            // earlier instructions out of the model's attention. Two is plenty.
            if (cp == '\n') {
                if (++consecutiveNewlines > 2) {
                    continue;
                }
            } else {
                consecutiveNewlines = 0;
            }
            out.appendCodePoint(cp);
        }

        return neutraliseFenceMarkers(out.toString()).trim();
    }

    /**
     * True for characters that carry no visible meaning in a typed question but do
     * reach the model: C0/C1 controls (bar tab and newline), the zero-width set,
     * bidi overrides, and the Tags block.
     */
    private static boolean isInvisibleOrControl(int cp) {
        if (cp == '\n' || cp == '\t') {
            return false;
        }
        return cp < 0x20                          // C0 controls
                || (cp >= 0x7F && cp <= 0x9F)     // DEL + C1 controls
                || cp == 0x00AD                   // soft hyphen
                || (cp >= 0x200B && cp <= 0x200F) // zero-width space/joiners + LRM/RLM
                || (cp >= 0x202A && cp <= 0x202E) // bidi embedding/override
                || (cp >= 0x2060 && cp <= 0x2064) // word joiner + invisible operators
                || (cp >= 0x2066 && cp <= 0x2069) // bidi isolates
                || cp == 0xFEFF                   // BOM / zero-width no-break space
                || (cp >= 0xFFF9 && cp <= 0xFFFB) // interlinear annotation
                || (cp >= 0xE0000 && cp <= 0xE007F); // Tags block — invisible ASCII
    }

    /**
     * True when {@code text} carries characters that are invisible to the person
     * who typed it but not to the model. Nobody types these by accident, so a hit
     * is a deliberate smuggling attempt and worth a log line. Detection only —
     * {@link #clean} does the removing.
     */
    static boolean hasHiddenCharacters(String text) {
        if (text == null) {
            return false;
        }
        return text.codePoints().anyMatch(cp -> cp != '\n' && cp != '\t' && isInvisibleOrControl(cp));
    }

    /**
     * Stops a message from forging prompt structure: it must not be able to mimic a
     * chat role marker or a system banner. The text stays readable — only the
     * structural punctuation is defanged.
     */
    private static String neutraliseFenceMarkers(String text) {
        return text
                // A markdown heading is how a "=== NEW INSTRUCTIONS ===" block is
                // usually dressed up; the persona forbids headings anyway.
                .replace("###", "# ##")
                // "<|im_start|>", "<|system|>" and friends are literal turn markers in
                // several chat templates; a lone "<" is harmless once the bar is gone.
                .replace("<|", "< |")
                .replace("|>", "| >")
                // Bare "system:" / "assistant:" at the start of a line reads as a new turn.
                .replaceAll("(?im)^\\s*(system|assistant|user)\\s*:", "$1 -");
    }
}
