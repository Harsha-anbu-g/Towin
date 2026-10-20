package com.towinly.assistant.evals;

import com.towinly.assistant.dto.ChatMessage;

import java.util.List;

/**
 * One question for the tortoise and the rules its answer must meet. Read from
 * {@code src/test/resources/assistant/evals.json}; every field name there matches
 * a component here, and an unknown field fails the load.
 *
 * @param id             short unique name, used in the scorecard
 * @param language       "en", "fr" or "ta": the language the person uses the site in
 * @param signedIn       true asks as the fixed persona, false asks as a visitor
 * @param question       what they type
 * @param history        earlier turns sent with the question, or null
 * @param mustIncludeAny at least one must appear in the reply (case-insensitive), or null
 * @param mustIncludeAll each must appear (case-insensitive), or null
 * @param mustNotInclude none may appear (case-insensitive), or null
 * @param maxSentences   upper bound on sentences, or null for the default of 8
 * @param script         "tamil" or "latin", or null for no script check
 */
public record EvalCase(
        String id,
        String language,
        boolean signedIn,
        String question,
        List<ChatMessage> history,
        List<String> mustIncludeAny,
        List<String> mustIncludeAll,
        List<String> mustNotInclude,
        Integer maxSentences,
        String script) {

    /** True when at least one rule beyond the free ones is set. */
    public boolean hasARule() {
        return nonEmpty(mustIncludeAny) || nonEmpty(mustIncludeAll) || nonEmpty(mustNotInclude)
                || maxSentences != null || script != null;
    }

    private static boolean nonEmpty(List<String> list) {
        return list != null && !list.isEmpty();
    }
}
