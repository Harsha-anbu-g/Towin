package com.towinly.assistant.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.towinly.common.enums.NeedCategory;
import com.towinly.common.enums.NeedUrgency;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Turns a proposal tool call into the one thing the app may ask the person to
 * confirm. The action's name is an app API function (src/api in the app); its
 * arguments are that function's input, built here from the model's JSON with a
 * whitelist of keys, every string sanitized and capped to the backend's own
 * limits, and every enum checked. The model cannot smuggle a key in, cannot
 * post for someone else, and cannot pass a value the write would reject.
 */
final class AssistantActions {

    static final String PROPOSE_CHECK_IN = "propose_check_in";
    static final String PROPOSE_HELP_REQUEST = "propose_help_request";
    private static final Set<String> PROPOSALS = Set.of(PROPOSE_CHECK_IN, PROPOSE_HELP_REQUEST);

    /** Same caps as NeedRequest, so the app's call cannot be refused for length. */
    private static final int MAX_TITLE = 200;
    private static final int MAX_DESCRIPTION = 2000;

    private static final ObjectMapper JSON = new ObjectMapper();

    private AssistantActions() {}

    static boolean isProposal(String toolName) {
        return PROPOSALS.contains(toolName);
    }

    /** The app action for a proposal call, or empty for a read tool or an unusable proposal. */
    static Optional<AssistantService.Action> toAction(GroqReply.ToolCall call) {
        return switch (call.name()) {
            case PROPOSE_CHECK_IN -> Optional.of(new AssistantService.Action("checkInToday", Map.of()));
            case PROPOSE_HELP_REQUEST -> helpRequest(call.arguments());
            default -> Optional.empty();
        };
    }

    private static Optional<AssistantService.Action> helpRequest(String json) {
        Map<String, Object> raw = parse(json);
        String title = text(raw.get("title"), MAX_TITLE);
        if (title.isBlank()) return Optional.empty();
        Map<String, Object> args = new LinkedHashMap<>();
        args.put("title", title);
        String description = text(raw.get("description"), MAX_DESCRIPTION);
        args.put("description", description.isBlank() ? null : description);
        args.put("category", oneOf(raw.get("category"), NeedCategory.class, NeedCategory.OTHER).name());
        args.put("urgency", oneOf(raw.get("urgency"), NeedUrgency.class, NeedUrgency.NORMAL).name());
        return Optional.of(new AssistantService.Action("postHelpRequest", args));
    }

    private static Map<String, Object> parse(String json) {
        try {
            Map<String, Object> m = JSON.readValue(json == null ? "{}" : json, new TypeReference<Map<String, Object>>() {});
            return m == null ? Map.of() : m;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String text(Object value, int max) {
        if (value == null) return "";
        return PromptSanitizer.clean(value.toString(), max).replace('\n', ' ').replace('\r', ' ').trim();
    }

    private static <E extends Enum<E>> E oneOf(Object value, Class<E> type, E fallback) {
        if (value == null) return fallback;
        try {
            return Enum.valueOf(type, value.toString().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }
}
