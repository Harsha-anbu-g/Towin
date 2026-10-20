package com.towinly.assistant.evals;

import com.towinly.assistant.dto.ChatRequest;
import com.towinly.assistant.security.AssistantRateLimiter;
import com.towinly.assistant.service.AssistantService;
import com.towinly.assistant.service.AssistantSpend;
import com.towinly.assistant.service.AssistantTools;
import com.towinly.assistant.service.GroqClient;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.NeedStatus;
import com.towinly.common.service.PostHogService;
import com.towinly.common.service.TrustScoreService;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.connection.service.ConnectionService;
import com.towinly.family.service.FamilyService;
import com.towinly.need.repository.NeedRepository;
import com.towinly.need.service.NeedService;
import com.towinly.profile.dto.ProfileResponse;
import com.towinly.profile.service.ProfileService;
import com.towinly.streak.dto.StreakResponse;
import com.towinly.streak.service.StreakService;
import com.towinly.trust.dto.TrustScoreBreakdownResponse;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.ClassPathResource;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Asks the real tortoise (real GroqClient, real AssistantService, real prompt and
 * knowledge base) every question in evals.json and scores the answers. Costs
 * tokens, so it runs only on purpose:
 *
 * <pre>
 *   TOWINLY_AI_EVALS=true GROQ_API_KEY=... ./mvnw -q -Dtest=AssistantEvalsTest test
 * </pre>
 *
 * <p>Optional: {@code GROQ_MODEL} (default openai/gpt-oss-120b) and
 * {@code TOWINLY_AI_EVALS_DELAY_MS} (default 2000, the pause between questions so
 * a free-tier rate limit is not tripped). The scorecard is printed to the test
 * output with the SHA-256 of the prompt text it was scored against, so a result
 * can be tied to an exact prompt. Signed-in questions are asked as Mary, the
 * fixed persona below; the data services are mocks so nothing touches a database.
 */
@EnabledIfEnvironmentVariable(named = "TOWINLY_AI_EVALS", matches = "true")
class AssistantEvalsTest {

    private static final UUID MARY = UUID.fromString("00000000-0000-0000-0000-00000000a11c");

    @Test
    void everyCasePasses() throws Exception {
        String key = System.getenv("GROQ_API_KEY");
        Assumptions.assumeTrue(key != null && !key.isBlank(), "GROQ_API_KEY is not set");
        long delayMs = Long.parseLong(System.getenv().getOrDefault("TOWINLY_AI_EVALS_DELAY_MS", "2000"));

        AssistantService service = realService(key);
        List<EvalCase> cases = EvalCases.load();
        List<String> failed = new ArrayList<>();

        System.out.println("Ask AI evals: " + cases.size() + " cases, prompt sha256=" + promptHash());
        System.out.printf("%-26s %-5s %7s  %s%n", "case", "ok", "ms", "notes");
        for (EvalCase c : cases) {
            ChatRequest request = new ChatRequest();
            request.setMessage(c.question());
            request.setHistory(c.history());

            long started = System.nanoTime();
            String reply = service.answer(request, c.signedIn() ? MARY : null, c.language());
            long ms = (System.nanoTime() - started) / 1_000_000;

            List<String> failures = EvalScorer.score(c, reply);
            boolean ok = failures.isEmpty();
            if (!ok) failed.add(c.id() + ": " + failures + " | reply: " + oneLine(reply));
            System.out.printf("%-26s %-5s %7d  %s%n", c.id(), ok ? "pass" : "FAIL", ms, ok ? "" : failures);
            Thread.sleep(delayMs);
        }

        System.out.println("Ask AI evals: " + (cases.size() - failed.size()) + "/" + cases.size() + " passed");
        assertThat(failed).as("failed cases").isEmpty();
    }

    /** The production wiring, minus Spring and minus the database. */
    private static AssistantService realService(String key) {
        GroqClient groq = new GroqClient(
                System.getenv().getOrDefault("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
                key,
                System.getenv().getOrDefault("GROQ_MODEL", "openai/gpt-oss-120b"),
                true,
                System.getenv().getOrDefault("GROQ_REASONING_EFFORT", "low"));
        AssistantSpend spend = new AssistantSpend(
                new AssistantRateLimiter(Integer.MAX_VALUE, Long.MAX_VALUE),
                new PostHogService("", "https://us.i.posthog.com"));
        return new AssistantService(groq, profile(), streak(), connections(), needs(), trust(), spend,
                new AssistantTools(mock(ConnectionService.class), mock(NeedService.class), mock(FamilyService.class)));
    }

    // --- Mary: elder, Getting Started, mid-week, with things waiting on her ---

    private static ProfileService profile() {
        ProfileService s = mock(ProfileService.class);
        when(s.getProfile(any())).thenReturn(ProfileResponse.builder()
                .userId(MARY).name("Mary Smith").role("ELDER").trustScore(12).trustTier("Getting Started")
                .verificationStatus("VERIFIED").city("Montreal").build());
        return s;
    }

    private static StreakService streak() {
        StreakService s = mock(StreakService.class);
        when(s.getStreak(any())).thenReturn(StreakResponse.builder()
                .currentStreak(3).longestStreak(9).alreadyCheckedIn(false).build());
        return s;
    }

    private static ConnectionRepository connections() {
        ConnectionRepository r = mock(ConnectionRepository.class);
        when(r.findByUserAndStatus(any(), eq(ConnectionStatus.ACTIVE))).thenReturn(List.of(new Connection()));
        when(r.findByUserAndStatus(any(), eq(ConnectionStatus.PENDING))).thenReturn(List.of(new Connection()));
        return r;
    }

    private static NeedRepository needs() {
        NeedRepository r = mock(NeedRepository.class);
        when(r.countByElderIdAndStatus(any(), eq(NeedStatus.OPEN))).thenReturn(1L);
        return r;
    }

    private static TrustScoreService trust() {
        TrustScoreService s = mock(TrustScoreService.class);
        TrustScoreBreakdownResponse.ProfileItem bio = TrustScoreBreakdownResponse.ProfileItem.builder()
                .key("bio").label("A few words about you").completed(false)
                .tip("Write two lines about yourself on your profile").build();
        TrustScoreBreakdownResponse.ProfileItem photo = TrustScoreBreakdownResponse.ProfileItem.builder()
                .key("photo").label("A photo").completed(false)
                .tip("Add a photo so people recognise you").build();
        TrustScoreBreakdownResponse.ProfileGroup intro = TrustScoreBreakdownResponse.ProfileGroup.builder()
                .key("intro").label("Introduce yourself").completed(true).items(List.of()).build();
        TrustScoreBreakdownResponse.ProfileGroup more = TrustScoreBreakdownResponse.ProfileGroup.builder()
                .key("more").label("Share more about you").completed(false).items(List.of(bio, photo)).build();
        when(s.getMyScoreBreakdown(any())).thenReturn(TrustScoreBreakdownResponse.builder()
                .totalScore(12).tier("Getting Started")
                .profile(TrustScoreBreakdownResponse.ProfileSection.builder()
                        .earned(1).max(3).groups(List.of(intro, more)).build())
                .build());
        return s;
    }

    private static String promptHash() throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        for (String path : List.of("assistant/system-prompt.txt", "assistant/knowledge.md")) {
            sha.update(new ClassPathResource(path).getContentAsByteArray());
        }
        return HexFormat.of().formatHex(sha.digest()).substring(0, 16);
    }

    private static String oneLine(String reply) {
        if (reply == null) return "";
        String flat = reply.replace('\n', ' ');
        return flat.length() > 160 ? flat.substring(0, 160) + "..." : flat;
    }
}
