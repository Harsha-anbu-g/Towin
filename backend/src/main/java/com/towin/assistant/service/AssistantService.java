package com.towin.assistant.service;

import com.towin.assistant.dto.ChatMessage;
import com.towin.assistant.dto.ChatRequest;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.NeedStatus;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.dto.ProfileResponse;
import com.towin.profile.service.ProfileService;
import com.towin.streak.dto.StreakResponse;
import com.towin.streak.service.StreakService;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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

    /** How many recent turns we forward — keeps prompts small and cheap. */
    private static final int MAX_HISTORY = 8;

    private static final String FALLBACK =
            "Sorry, I can't answer just now. Please try again in a moment. "
            + "If it keeps happening, use the Feedback button and the ToWin team will help.";

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
                + "\n\n=== TOWIN KNOWLEDGE BASE ===\n"
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
                    + "reaches the ToWin team.";
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

        List<ChatMessage> conversation = new ArrayList<>();
        if (request.getHistory() != null) {
            List<ChatMessage> h = request.getHistory();
            for (ChatMessage m : h.subList(Math.max(0, h.size() - MAX_HISTORY), h.size())) {
                if (m.getContent() != null && !m.getContent().isBlank()
                        && ("user".equals(m.getRole()) || "assistant".equals(m.getRole()))) {
                    conversation.add(m);
                }
            }
        }
        conversation.add(new ChatMessage("user", request.getMessage()));

        Optional<String> reply = groqClient.complete(systemPrompt, conversation);
        return reply.orElse(FALLBACK);
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
                    sb.append("- First name: ").append(firstName(p.getName())).append('\n');
                }
                if (notBlank(p.getRole())) sb.append("- Role: ").append(p.getRole()).append('\n');
                if (p.getTrustScore() != null) {
                    sb.append("- Trust score: ").append(p.getTrustScore());
                    if (notBlank(p.getTrustTier())) sb.append(" (tier: ").append(p.getTrustTier()).append(')');
                    sb.append('\n');
                }
                if (notBlank(p.getVerificationStatus())) {
                    sb.append("- Identity verification: ").append(p.getVerificationStatus()).append('\n');
                }
                if (notBlank(p.getCity())) sb.append("- City: ").append(p.getCity()).append('\n');
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

    private static String firstName(String name) {
        String trimmed = name.trim();
        int space = trimmed.indexOf(' ');
        return space > 0 ? trimmed.substring(0, space) : trimmed;
    }
}
