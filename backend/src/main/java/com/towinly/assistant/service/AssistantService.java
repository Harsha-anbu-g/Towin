package com.towinly.assistant.service;

import com.towinly.assistant.dto.ChatMessage;
import com.towinly.assistant.dto.ChatRequest;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.NeedStatus;
import com.towinly.common.service.TrustScoreService;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.profile.dto.ProfileResponse;
import com.towinly.profile.service.ProfileService;
import com.towinly.streak.dto.StreakResponse;
import com.towinly.streak.service.StreakService;
import com.towinly.trust.dto.TrustScoreBreakdownResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * "Ask AI" — the tortoise help assistant. Grounds every answer in a curated
 * product knowledge base (never a raw dump of repo notes) and, for signed-in
 * users, a small own-data-only summary so it can answer "what is my trust
 * score?". Talking to Groq is delegated to {@link GroqClient}; this class owns
 * the prompt assembly and the graceful fallbacks.
 */
@Slf4j
@Service
public class AssistantService {

    /** How many recent turns we forward — enough to hold a real back-and-forth. */
    private static final int MAX_HISTORY = 20;

    /**
     * Characters of conversation we will pay to send, across the question and all
     * history together. The per-field caps in {@link ChatRequest} bound each value
     * on its own; this bounds their sum, which is what the bill is actually charged
     * on. Oldest turns are dropped first, so a long genuine chat degrades into a
     * shorter memory instead of failing.
     */
    private static final int MAX_CONVERSATION_CHARS = 12_000;

    /** Personal facts are short labels; anything longer is not a name or a city. */
    private static final int MAX_PERSONAL_FIELD_CHARS = 120;

    private static final String FALLBACK =
            "Sorry, I can't answer just now. Please try again in a moment. "
            + "If it keeps happening, use the Feedback button and the Towinly team will help.";

    private final GroqClient groqClient;
    private final ProfileService profileService;
    private final StreakService streakService;
    private final ConnectionRepository connectionRepository;
    private final NeedRepository needRepository;
    private final TrustScoreService trustScoreService;

    /** System prompt = tortoise persona/rules + the product knowledge base. Loaded once. */
    private final String basePrompt;

    public AssistantService(GroqClient groqClient,
                            ProfileService profileService,
                            StreakService streakService,
                            ConnectionRepository connectionRepository,
                            NeedRepository needRepository,
                            TrustScoreService trustScoreService) {
        this.groqClient = groqClient;
        this.profileService = profileService;
        this.streakService = streakService;
        this.connectionRepository = connectionRepository;
        this.needRepository = needRepository;
        this.trustScoreService = trustScoreService;
        this.basePrompt = loadResource("assistant/system-prompt.txt")
                + "\n\n=== TOWINLY KNOWLEDGE BASE ===\n"
                + loadResource("assistant/knowledge.md");
    }

    /**
     * Answers one question. {@code userId} is null for logged-out visitors (they
     * get general help only); when present, a personal-context block is added.
     */
    public String answer(ChatRequest request, UUID userId) {
        if (!groqClient.isConfigured()) {
            return "The help assistant isn't switched on yet. In the meantime, the "
                    + "\"How it works\" guide covers the basics, and the Feedback button "
                    + "reaches the Towinly team.";
        }

        String systemPrompt = basePrompt;
        if (userId != null) {
            String personal = buildPersonalContext(userId);
            if (personal != null) {
                systemPrompt += "\n\n=== ABOUT THE PERSON YOU ARE HELPING (signed in) ===\n" + personal;
            }
        } else {
            systemPrompt += "\n\n=== ABOUT THE PERSON YOU ARE HELPING ===\n"
                    + "They are NOT signed in. You cannot see any personal details. If they ask a "
                    + "personal question (like their trust score or streak), kindly tell them to log in first.";
        }

        String question = PromptSanitizer.clean(request.getMessage(), ChatRequest.MAX_MESSAGE_CHARS);
        if (question.isBlank()) {
            // Everything they sent was strippable — i.e. the "question" was nothing but
            // hidden characters. There is no genuine question here to answer.
            log.warn("Ask AI: rejected a question that was entirely hidden characters (userId={})", userId);
            return "Sorry, I couldn't read that question. Could you type it again in plain words?";
        }
        if (PromptSanitizer.hasHiddenCharacters(request.getMessage())) {
            log.warn("Ask AI: stripped hidden characters from a question (userId={})", userId);
        }

        List<ChatMessage> conversation = buildConversation(request, question);

        Optional<String> reply = groqClient.complete(systemPrompt, conversation);
        return reply.orElse(FALLBACK);
    }

    /**
     * The turns we actually pay to send: the sanitised question, preceded by as much
     * recent history as the character budget allows.
     *
     * <p>History arrives from the browser on every request, so none of it is trusted.
     * Roles are re-checked here even though {@link ChatMessage} already constrains
     * them — validation guards the HTTP edge, this guards the call to Groq, and the
     * two are worth keeping independent. Turns are taken newest-first so that when
     * the budget runs out it is the oldest context that is lost, then flipped back
     * into chronological order for the model.
     */
    private List<ChatMessage> buildConversation(ChatRequest request, String question) {
        List<ChatMessage> recent = new ArrayList<>();
        int budget = MAX_CONVERSATION_CHARS - question.length();

        List<ChatMessage> history = request.getHistory();
        if (history != null) {
            List<ChatMessage> window = history.subList(Math.max(0, history.size() - MAX_HISTORY), history.size());
            for (int i = window.size() - 1; i >= 0; i--) {
                ChatMessage m = window.get(i);
                if (!"user".equals(m.getRole()) && !"assistant".equals(m.getRole())) {
                    continue;
                }
                String content = PromptSanitizer.clean(m.getContent(), ChatMessage.MAX_CONTENT_CHARS);
                if (content.isBlank()) {
                    continue; // an empty turn carries nothing; it must not truncate older ones
                }
                if (content.length() > budget) {
                    break; // out of budget — everything older is dropped with it
                }
                budget -= content.length();
                recent.add(new ChatMessage(m.getRole(), content));
            }
            Collections.reverse(recent);
        }

        recent.add(new ChatMessage("user", question));
        return recent;
    }

    /**
     * A compact, non-identifying summary of the signed-in user's OWN data. Never
     * includes another person's data, contact details, or message contents. Any
     * failure (e.g. no profile yet) returns null so chat still works generally.
     */
    private String buildPersonalContext(UUID userId) {
        try {
            StringBuilder sb = new StringBuilder();
            ProfileResponse p = profileService.getProfile(userId);
            if (p != null) {
                if (notBlank(p.getName())) {
                    sb.append("- First name: ").append(safeFact(firstName(p.getName()))).append('\n');
                }
                if (notBlank(p.getRole())) sb.append("- Role: ").append(safeFact(p.getRole())).append('\n');
                if (p.getTrustScore() != null) {
                    sb.append("- Trust score: ").append(p.getTrustScore());
                    if (notBlank(p.getTrustTier())) sb.append(" (tier: ").append(safeFact(p.getTrustTier())).append(')');
                    sb.append('\n');
                }
                if (notBlank(p.getVerificationStatus())) {
                    sb.append("- Identity verification: ").append(safeFact(p.getVerificationStatus())).append('\n');
                }
                if (notBlank(p.getCity())) sb.append("- City: ").append(safeFact(p.getCity())).append('\n');
            }

            StreakResponse s = streakService.getStreak(userId);
            if (s != null) {
                sb.append("- Daily streak: ").append(s.getCurrentStreak())
                        .append(" day(s) in a row (best ever: ").append(s.getLongestStreak()).append("). ")
                        .append(s.isAlreadyCheckedIn() ? "Already checked in today." : "Has not checked in today yet.")
                        .append('\n');
            }

            long active = connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE).size();
            long pending = connectionRepository.findByUserAndStatus(userId, ConnectionStatus.PENDING).size();
            sb.append("- Active connections: ").append(active)
                    .append(". Requests still waiting for a reply: ").append(pending).append('\n');

            long openRequests = needRepository.countByElderIdAndStatus(userId, NeedStatus.OPEN);
            sb.append("- Open help requests they have posted: ").append(openRequests).append('\n');

            appendProfileGaps(sb, userId);

            sb.append("Answer personal questions using ONLY the facts above. If they ask for a "
                    + "personal detail not listed here, say you don't have that detail and point them "
                    + "to the right page in the app.\n\n"
                    + "If they ask something like \"what should I do next\" or \"what should I do today\", "
                    + "give ONE or TWO short, specific, encouraging suggestions built from the facts above "
                    + "(for example: they haven't checked in today, or a profile item is missing, or a "
                    + "connection request is waiting for their reply). Do not suggest anything not "
                    + "supported by these facts.");
            return sb.toString();
        } catch (Exception e) {
            log.warn("Ask AI: could not build personal context for {}: {}", userId, e.getMessage());
            return null;
        }
    }

    /**
     * Appends unfinished profile items (with the same tips shown on the Trust
     * page) so the assistant can give real, specific "what should I do next"
     * coaching instead of generic advice.
     */
    private void appendProfileGaps(StringBuilder sb, UUID userId) {
        try {
            TrustScoreBreakdownResponse breakdown = trustScoreService.getMyScoreBreakdown(userId);
            if (breakdown == null || breakdown.getProfile() == null) return;

            List<String> gaps = new ArrayList<>();
            for (var group : breakdown.getProfile().getGroups()) {
                if (group.isCompleted()) continue;
                for (var item : group.getItems()) {
                    if (!item.isCompleted() && item.getTip() != null) {
                        gaps.add(item.getLabel() + " — " + item.getTip());
                    }
                }
            }

            if (gaps.isEmpty()) {
                sb.append("- Profile completeness: fully done, all 3 sections complete.\n");
            } else {
                sb.append("- Profile completeness: not finished yet. Missing, in order:\n");
                for (String gap : gaps) sb.append("  - ").append(gap).append('\n');
            }
        } catch (Exception e) {
            log.warn("Ask AI: could not build profile gaps for {}: {}", userId, e.getMessage());
        }
    }

    private String loadResource(String path) {
        try {
            return StreamUtils.copyToString(
                    new ClassPathResource(path).getInputStream(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Ask AI: failed to load resource {}: {}", path, e.getMessage());
            return "";
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * Makes a profile value safe to interpolate into the system prompt.
     *
     * <p>Their name and city are whatever they typed into their profile, and this
     * block is the privileged part of the prompt — the part the model trusts most.
     * Someone who sets their display name to a line of instructions would otherwise
     * have that line delivered with the authority of our own rules, which is a far
     * better position than typing it into the chat box. Newlines go too: a fact
     * spanning lines could open what looks like a new instruction section.
     */
    private static String safeFact(String value) {
        return PromptSanitizer.clean(value, MAX_PERSONAL_FIELD_CHARS).replace('\n', ' ');
    }

    private static String firstName(String name) {
        String trimmed = name.trim();
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(0, space) : trimmed;
    }
}
