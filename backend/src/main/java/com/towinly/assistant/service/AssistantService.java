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
import java.util.Locale;
import java.util.Map;
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

    /**
     * The replies this class writes itself, in each language the site speaks. The
     * model's own answers follow {@link #LANGUAGE_RULE}; these never reach the model,
     * so they are translated here rather than left in English for a French or Tamil reader.
     */
    private static final Map<String, Map<String, String>> CANNED = Map.of(
            "fallback", Map.of(
                    "en", "Sorry, I can't answer just now. Please try again in a moment. "
                            + "If it keeps happening, use the Feedback button and the Towinly team will help.",
                    "fr", "Désolée, je ne peux pas répondre tout de suite. Réessayez dans un instant. "
                            + "Si cela continue, utilisez le bouton Avis et l'équipe Towinly vous aidera.",
                    "ta", "மன்னிக்கவும், இப்போது பதில் சொல்ல முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயலுங்கள். "
                            + "தொடர்ந்து இப்படி நடந்தால், கருத்து பொத்தானைப் பயன்படுத்துங்கள்; Towinly குழு உதவும்."),
            "off", Map.of(
                    "en", "The help assistant isn't switched on yet. In the meantime, the "
                            + "\"How it works\" guide covers the basics, and the Feedback button "
                            + "reaches the Towinly team.",
                    "fr", "L'assistant n'est pas encore activé. En attendant, le guide « Comment ça marche » "
                            + "explique l'essentiel, et le bouton Avis joint l'équipe Towinly.",
                    "ta", "உதவியாளர் இன்னும் இயக்கப்படவில்லை. அதுவரை, \"இது எப்படி வேலை செய்கிறது\" "
                            + "வழிகாட்டி அடிப்படைகளை விளக்கும்; கருத்து பொத்தான் Towinly குழுவை அடையும்."),
            "unreadable", Map.of(
                    "en", "Sorry, I couldn't read that question. Could you type it again in plain words?",
                    "fr", "Désolée, je n'ai pas pu lire cette question. Pouvez-vous la retaper avec des mots simples?",
                    "ta", "மன்னிக்கவும், அந்தக் கேள்வியைப் படிக்க முடியவில்லை. எளிய சொற்களில் மீண்டும் தட்டச்சு செய்ய முடியுமா?"));

    /** How the reply language is put to the model; the site's own words for its buttons and pages. */
    private static final Map<String, String> LANGUAGE_RULE = Map.of(
            "en", "Reply in simple English.",
            "fr", "The person is using Towinly in French. Reply in simple, warm French as spoken in "
                    + "Quebec, using the formal \"vous\". Call the roles Aîné (Elder), Aidant (Helper) and "
                    + "Famille (Family), the SOS button \"SOS\", the Feedback button \"Avis\", and the "
                    + "guide \"Comment ça marche\". If they write in another language, answer in theirs.",
            "ta", "The person is using Towinly in Tamil. Reply in simple, warm, formal Tamil (use "
                    + "நீங்கள்). Call the roles மூத்தவர் (Elder), உதவியாளர் (Helper) and குடும்பம் (Family), "
                    + "keep \"SOS\" as it is, call the Feedback button \"கருத்து\", and the guide "
                    + "\"இது எப்படி வேலை செய்கிறது\". If they write in another language, answer in theirs.");

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
        return answer(request, userId, "en");
    }

    /**
     * Answers one question in {@code language} ("en", "fr" or "ta"; anything else
     * reads as English), the language the person chose on the site.
     */
    public String answer(ChatRequest request, UUID userId, String language) {
        String lang = LANGUAGE_RULE.containsKey(language) ? language : "en";
        if (!groqClient.isConfigured()) {
            return CANNED.get("off").get(lang);
        }

        String systemPrompt = basePrompt + "\n\n=== LANGUAGE ===\n" + LANGUAGE_RULE.get(lang);
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
            return CANNED.get("unreadable").get(lang);
        }
        if (PromptSanitizer.hasHiddenCharacters(request.getMessage())) {
            log.warn("Ask AI: stripped hidden characters from a question (userId={})", userId);
        }

        List<ChatMessage> conversation = buildConversation(request, question);

        Optional<String> reply = groqClient.complete(systemPrompt, conversation);
        return reply.orElse(CANNED.get("fallback").get(lang));
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

    /**
     * The site's language from an Accept-Language header: "fr" or "ta" when the
     * first choice is one of those, English otherwise. The browser and the app
     * send the language the person picked, not just the device's.
     */
    public static String languageOf(String acceptLanguage) {
        if (acceptLanguage == null) return "en";
        String first = acceptLanguage.split(",")[0].trim().toLowerCase(Locale.ROOT);
        if (first.startsWith("fr")) return "fr";
        if (first.startsWith("ta")) return "ta";
        return "en";
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
