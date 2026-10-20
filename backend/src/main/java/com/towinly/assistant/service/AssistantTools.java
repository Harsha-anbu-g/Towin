package com.towinly.assistant.service;

import com.towinly.common.enums.ApplicationStatus;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.connection.dto.ConnectionResponse;
import com.towinly.connection.service.ConnectionService;
import com.towinly.family.dto.FamilyLinkResponse;
import com.towinly.family.dto.FamilyLinksResponse;
import com.towinly.family.service.FamilyService;
import com.towinly.need.dto.ApplicantDto;
import com.towinly.need.dto.NeedResponse;
import com.towinly.need.service.NeedService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The read-only tools Ask AI may call for a signed-in person: their own
 * connections, help requests and family, as plain lines the model can answer
 * from. Nothing here writes, and nothing here reaches past the person asking.
 *
 * <p>Every string that came from a database row (a display name, a request
 * title, a relationship) passes {@link PromptSanitizer} and loses its newlines
 * before it goes into the prompt, because a tool result is read by the model
 * with more trust than the chat box. Names are first names only: that is what
 * the app shows, and it is all an answer needs.
 */
@Slf4j
@Component
public class AssistantTools {

    static final String UNKNOWN = "Unknown tool.";
    static final String UNAVAILABLE = "This detail is not available right now.";

    /** Longest value lifted from a row into the prompt. A name or a title is far shorter. */
    private static final int MAX_FIELD_CHARS = 120;
    private static final int MAX_REQUESTS = 20;

    /** Groq's function-tool shape. No parameters: each tool answers for the person asking. */
    public static final List<Map<String, Object>> DEFINITIONS = List.of(
            tool("get_my_connections",
                    "The person's own connections: who, at which Trust Journey step, whose turn the next "
                    + "step is, unread messages, and requests still waiting. Use for questions about their "
                    + "friendships, helpers or elders."),
            tool("get_my_help_requests",
                    "For an elder: the help requests they posted, with status and who has offered. For a "
                    + "helper: the offers they made and where each stands."),
            tool("get_my_family",
                    "The person's family links and family requests, and who is the main contact."));

    private final ConnectionService connectionService;
    private final NeedService needService;
    private final FamilyService familyService;

    public AssistantTools(ConnectionService connectionService, NeedService needService, FamilyService familyService) {
        this.connectionService = connectionService;
        this.needService = needService;
        this.familyService = familyService;
    }

    /** Runs one tool for the signed-in person. Never throws: a failure becomes a kind sentence. */
    public String run(String name, UUID userId) {
        try {
            return switch (name) {
                case "get_my_connections" -> connections(userId);
                case "get_my_help_requests" -> helpRequests(userId);
                case "get_my_family" -> family(userId);
                default -> UNKNOWN;
            };
        } catch (Exception e) {
            log.warn("Ask AI tool {} failed for {}: {}", name, userId, e.getMessage());
            return UNAVAILABLE;
        }
    }

    private String connections(UUID userId) {
        List<String> lines = new ArrayList<>();
        for (ConnectionResponse c : connectionService.getMyConnections(userId, ConnectionStatus.ACTIVE)) {
            lines.add("- " + who(c) + ": active, at " + stage(c) + "; " + turn(c) + "; "
                    + unread(c.getUnreadCount()) + "; " + (c.isInitiatedByMe() ? "you asked first." : "they asked first."));
        }
        for (ConnectionResponse c : connectionService.getMyConnections(userId, ConnectionStatus.PENDING)) {
            lines.add("- " + who(c) + ": request waiting; " + (c.isInitiatedByMe()
                    ? "you asked, waiting for their answer." : "they asked, you can accept or decline."));
        }
        return lines.isEmpty() ? "No connections yet." : String.join("\n", lines);
    }

    private String helpRequests(UUID userId) {
        List<String> lines = new ArrayList<>();
        for (NeedResponse n : needService.getMyNeeds(userId, 0, MAX_REQUESTS).getContent()) {
            lines.add("- \"" + safe(n.getTitle()) + "\": " + lower(n.getStatus()) + "; " + offers(n));
        }
        for (NeedResponse n : needService.getMyApplications(userId)) {
            lines.add("- \"" + safe(n.getTitle()) + "\" for " + first(n.getElderName()) + ": your offer is "
                    + lower(n.getMyApplicationStatus()) + "; the request is " + lower(n.getStatus()) + ".");
        }
        return lines.isEmpty() ? "No help requests or offers." : String.join("\n", lines);
    }

    private String family(UUID userId) {
        FamilyLinksResponse links = familyService.getLinks(userId);
        List<String> lines = new ArrayList<>();
        for (FamilyLinkResponse l : nullSafe(links.getActiveLinks())) {
            lines.add("- " + first(l.getOtherUserName()) + " (" + safe(l.getRelationship()) + ")"
                    + (Boolean.TRUE.equals(l.getIsPrimary()) ? ", main contact." : "."));
        }
        for (FamilyLinkResponse l : nullSafe(links.getIncomingRequests())) {
            lines.add("- " + first(l.getOtherUserName()) + " (" + safe(l.getRelationship())
                    + ") asked to link; waiting for your answer.");
        }
        for (FamilyLinkResponse l : nullSafe(links.getOutgoingRequests())) {
            lines.add("- You asked " + first(l.getOtherUserName()) + " (" + safe(l.getRelationship())
                    + "); waiting for their answer.");
        }
        return lines.isEmpty() ? "No family linked." : String.join("\n", lines);
    }

    // --- wording helpers ---

    private static String who(ConnectionResponse c) {
        String role = c.getOtherUserRole() == null ? "" : " (" + capitalize(c.getOtherUserRole().name()) + ")";
        return first(c.getOtherUserName()) + role;
    }

    private static String stage(ConnectionResponse c) {
        return c.getCurrentTrustLevel() == null ? "Just Connected" : c.getCurrentTrustLevel().label();
    }

    private static String turn(ConnectionResponse c) {
        if (c.getCurrentTrustLevel() != null && c.getCurrentTrustLevel().next() == c.getCurrentTrustLevel()) {
            return "at the last step";
        }
        if (c.isConfirmedByOther() && !c.isConfirmedByMe()) return "the next step waits on you";
        if (c.isConfirmedByMe() && !c.isConfirmedByOther()) return "the next step waits on them";
        return "nobody has tapped the next step yet";
    }

    private static String unread(int n) {
        return n == 1 ? "1 unread message" : n + " unread messages";
    }

    private static String offers(NeedResponse n) {
        List<ApplicantDto> apps = nullSafe(n.getApplications());
        String accepted = apps.stream().filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .map(a -> first(a.getHelperName())).findFirst().orElse(null);
        if (accepted != null) return "accepted helper: " + accepted + ".";
        long waiting = apps.stream().filter(a -> a.getStatus() == ApplicationStatus.PENDING).count();
        if (waiting == 0) return "no offers yet.";
        return waiting == 1 ? "1 helper waiting for your answer." : waiting + " helpers waiting for your answer.";
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list;
    }

    private static String lower(Enum<?> value) {
        return value == null ? "unknown" : value.name().toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    private static String capitalize(String upper) {
        String lower = upper.toLowerCase(Locale.ROOT);
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    /** First name only, sanitized. "Someone" when there is no name at all. */
    private static String first(String name) {
        String clean = safe(name);
        if (clean.isBlank()) return "Someone";
        int space = clean.indexOf(' ');
        return space > 0 ? clean.substring(0, space) : clean;
    }

    /** A row value made safe for the prompt: hidden characters stripped, capped, newlines gone. */
    private static String safe(String value) {
        if (value == null) return "";
        return PromptSanitizer.clean(value, MAX_FIELD_CHARS).replace('\n', ' ').replace('\r', ' ').trim();
    }

    private static Map<String, Object> tool(String name, String description) {
        return Map.of("type", "function", "function", Map.of(
                "name", name,
                "description", description,
                "parameters", Map.of("type", "object", "properties", Map.of(), "required", List.of())));
    }
}
