package com.towinly.passon.controller;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.common.repository.UserRepository;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.security.SealedRevealRateLimiter;
import com.towinly.passon.service.KeyholderService;
import com.towinly.passon.service.PassOnAlertService;
import com.towinly.passon.service.PassOnService;
import com.towinly.passon.service.SealedBoxService;
import com.towinly.passon.service.SealedCryptoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The four routes that reach into the Sealed box, driven end to end: a real
 * {@link SealedCryptoService} under a test key, a real {@link SealedBoxService}, the real
 * {@link GlobalExceptionHandler}, and an in-memory stand-in for the table.
 *
 * <h2>Why the crypto is real here</h2>
 * These routes are the only way anything ever gets into or out of the box, so a mocked
 * cipher would prove that the wiring calls something rather than that an elder can put a
 * thing in and read it back. What is asserted below is the round trip through genuine
 * AES-GCM, and — on the same rows — that nothing readable was written down.
 *
 * <h2>What the refusals must read like</h2>
 * {@code GlobalExceptionHandler} does not pass exception text through; it looks the message
 * up and falls back to <em>"Invalid request."</em>. A freeze that reaches Margaret as two
 * useless words tells her nothing about why her own box will not open or when it will, so
 * every refusal here is asserted as the sentence she actually reads.
 *
 * <p>Margaret is the elder. The stranger is anybody else who has guessed an item id.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PassOnControllerSealedTest {

    /** 5 August 2026. Seven days on is 12 August, the same day the spec uses. */
    private static final Instant TODAY = Instant.parse("2026-08-05T10:00:00Z");

    /** Test-only key, on the same footing as the test JWT secret. Exactly 32 bytes. */
    private static final String TEST_MASTER_KEY = Base64.getEncoder()
            .encodeToString("test-only-sealed-box-key-32bytes".getBytes(StandardCharsets.UTF_8));

    private static final String PASSWORD = "the-elders-own-password";
    private static final String HASH = "$2a$10$notarealbcrypthashbutlongenough";

    private static final String LABEL = "Where the house papers are";
    private static final String BODY = "In the brown envelope, second drawer of the writing desk.";

    @Mock SealedItemRepository sealedItems;
    @Mock PassOnSettingsRepository settings;
    @Mock PassOnOpenRepository opens;
    @Mock UserRepository users;
    @Mock PasswordEncoder passwordEncoder;
    @Mock PassOnAlertService alerts;
    @Mock KeyholderService keyholders;
    @Mock PassOnService passOnService;

    /** Stands in for passon_sealed_items, so a create and the list after it see one table. */
    private final Map<UUID, SealedItem> table = new LinkedHashMap<>();

    private Clock clock;
    private MockMvc mockMvc;
    private User margaret;
    private User stranger;
    private Authentication margaretsSession;
    private Authentication strangersSession;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(TODAY, ZoneOffset.UTC);
        SealedBoxService sealedBox = new SealedBoxService(sealedItems, settings, opens, users,
                new SealedCryptoService(TEST_MASTER_KEY), passwordEncoder,
                new SealedRevealRateLimiter(clock), alerts, keyholders, clock);

        mockMvc = MockMvcBuilders
                .standaloneSetup(new PassOnController(passOnService, keyholders, sealedBox))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        margaret = user("Margaret", UserRole.ELDER);
        stranger = user("Somebody else", UserRole.FAMILY);
        margaretsSession = new UsernamePasswordAuthenticationToken(margaret.getId().toString(), null);
        strangersSession = new UsernamePasswordAuthenticationToken(stranger.getId().toString(), null);

        when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(users.findById(stranger.getId())).thenReturn(Optional.of(stranger));
        // Both of them know their own password. What separates them is whose row it is.
        when(passwordEncoder.matches(PASSWORD, HASH)).thenReturn(true);

        when(sealedItems.save(any())).thenAnswer(call -> {
            SealedItem row = call.getArgument(0);
            // Postgres stamps this on insert; the list and the card both read it back.
            if (row.getCreatedAt() == null) row.setCreatedAt(LocalDateTime.now(clock));
            table.put(row.getId(), row);
            return row;
        });
        when(sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(any())).thenAnswer(call -> {
            UUID ownerId = call.getArgument(0);
            return table.values().stream()
                    .filter(row -> row.getOwner().getId().equals(ownerId))
                    .sorted(Comparator.comparing(SealedItem::getSortOrder)
                            .thenComparing(SealedItem::getCreatedAt))
                    .toList();
        });
        // Ownership is part of the lookup, exactly as it is in the repository.
        when(sealedItems.findByIdAndOwnerId(any(), any())).thenAnswer(call -> {
            SealedItem row = table.get(call.getArgument(0, UUID.class));
            return row != null && row.getOwner().getId().equals(call.getArgument(1, UUID.class))
                    ? Optional.of(row) : Optional.empty();
        });
        doAnswer(call -> table.remove(call.getArgument(0, SealedItem.class).getId()))
                .when(sealedItems).delete(any());
    }

    // ── the round trip ──

    @Test
    void createThenListThenRevealRoundTrips() throws Exception {
        String created = mockMvc.perform(post("/api/passon/sealed").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(itemBody(LABEL, BODY, "PAPERS")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value(LABEL))
                .andExpect(jsonPath("$.kindHint").value("PAPERS"))
                .andReturn().getResponse().getContentAsString();
        UUID itemId = UUID.fromString(idIn(created));

        // Nothing readable reached the row, including the name of the thing.
        SealedItem row = table.get(itemId);
        assertThat(new String(row.getLabelCipher(), StandardCharsets.UTF_8)).doesNotContain("papers");
        assertThat(new String(row.getBodyCipher(), StandardCharsets.UTF_8)).doesNotContain("drawer");

        mockMvc.perform(get("/api/passon/sealed").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(itemId.toString()))
                .andExpect(jsonPath("$[0].label").value(LABEL));

        mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody(PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value(LABEL))
                .andExpect(jsonPath("$.body").value(BODY));
    }

    @Test
    void listNeverReturnsBodies() throws Exception {
        putInTheBox(margaret, LABEL, BODY);
        putInTheBox(margaret, "The bank", "Account 12345678, sort code 01-02-03.");

        String listed = mockMvc.perform(get("/api/passon/sealed").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].label").value(LABEL))
                .andExpect(jsonPath("$[1].label").value("The bank"))
                // There is no body field on this shape, and there must never be one.
                .andExpect(jsonPath("$[0].body").doesNotExist())
                .andExpect(jsonPath("$[1].body").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        assertThat(listed).doesNotContain("drawer").doesNotContain("12345678");
    }

    @Test
    void theListIsOnlyEverTheSignedInPersonsOwn() throws Exception {
        putInTheBox(margaret, LABEL, BODY);

        // The stranger asks the same route. There is no owner in the path to ask as.
        mockMvc.perform(get("/api/passon/sealed").principal(strangersSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ── the password gate ──

    @Test
    void revealWithTheWrongPasswordIsRejected() throws Exception {
        UUID itemId = putInTheBox(margaret, LABEL, BODY);
        when(passwordEncoder.matches("guess", HASH)).thenReturn(false);

        String refused = mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody("guess")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("That password was not right. Please try again."))
                .andReturn().getResponse().getContentAsString();

        assertThat(refused).doesNotContain("drawer");
    }

    @Test
    void tooManyWrongPasswordsAreRefusedWithoutLookingAtTheNextOne() throws Exception {
        UUID itemId = putInTheBox(margaret, LABEL, BODY);
        when(passwordEncoder.matches("guess", HASH)).thenReturn(false);

        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal").principal(margaretsSession)
                            .accept(MediaType.APPLICATION_JSON)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(passwordBody("guess")))
                    .andExpect(status().isBadRequest());
        }

        // The sixth try is refused before the password is looked at — even the right one.
        mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody(PASSWORD)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(SealedRevealRateLimiter.TOO_MANY_TRIES));
    }

    @Test
    void anEmptyPasswordIsAskedForInPlainWords() throws Exception {
        UUID itemId = putInTheBox(margaret, LABEL, BODY);

        mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody("")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please type your password to see this."));
    }

    // ── the freeze ──

    @Test
    void revealIsRefusedInsideTheSevenDayFreeze() throws Exception {
        UUID itemId = putInTheBox(margaret, LABEL, BODY);
        // She reset her password an hour ago — or somebody holding her inbox did.
        margaret.setCredentialChangedAt(LocalDateTime.ofInstant(TODAY, ZoneOffset.UTC).minusHours(1));

        String refused = mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody(PASSWORD)))
                .andExpect(status().isBadRequest())
                // The real date, in her own words. A generic refusal here would leave her
                // unable to tell a safety rule from a broken app.
                .andExpect(jsonPath("$.message").value(
                        "You changed your password recently. For your safety your Sealed box stays "
                                + "shut until 12 August. If that was not you, tell us straight away."))
                .andReturn().getResponse().getContentAsString();

        assertThat(refused).doesNotContain("drawer");
    }

    // ── somebody else's box ──

    @Test
    void anotherUsersSealedItemIsNotFound() throws Exception {
        UUID itemId = putInTheBox(margaret, LABEL, BODY);

        // Not 403. A "you may not" would confirm to a stranger that this id is a real item
        // belonging to somebody, which is already more than they should be able to learn.
        mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal").principal(strangersSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody(PASSWORD)))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/passon/sealed/" + itemId).principal(strangersSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());

        // And her thing is still in her box.
        assertThat(table).containsKey(itemId);
    }

    // ── taking something out ──

    @Test
    void theOwnerCanTakeAThingOutOfHerOwnBox() throws Exception {
        UUID itemId = putInTheBox(margaret, LABEL, BODY);

        mockMvc.perform(delete("/api/passon/sealed/" + itemId).principal(margaretsSession))
                .andExpect(status().isNoContent());

        assertThat(table).doesNotContainKey(itemId);
    }

    // ── what must never be kept ──

    @Test
    void theRevealedBodyIsNeverCached() throws Exception {
        UUID itemId = putInTheBox(margaret, LABEL, BODY);

        mockMvc.perform(post("/api/passon/sealed/" + itemId + "/reveal").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordBody(PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    // ── fixtures ──

    /** Puts one thing in somebody's box the way the route does, and hands back its id. */
    private UUID putInTheBox(User owner, String label, String body) throws Exception {
        Authentication session =
                new UsernamePasswordAuthenticationToken(owner.getId().toString(), null);
        String created = mockMvc.perform(post("/api/passon/sealed").principal(session)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(itemBody(label, body, "PAPERS")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(idIn(created));
    }

    private static String itemBody(String label, String body, String kindHint) {
        return "{\"label\":" + quoted(label) + ",\"body\":" + quoted(body)
                + ",\"kindHint\":\"" + kindHint + "\"}";
    }

    private static String passwordBody(String password) {
        return "{\"password\":" + quoted(password) + "}";
    }

    private static String quoted(String text) {
        if (text == null) return "null";
        return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    /** The id out of a JSON object, without pulling a parser into the test. */
    private static String idIn(String json) {
        int at = json.indexOf("\"id\":\"") + "\"id\":\"".length();
        return json.substring(at, json.indexOf('"', at));
    }

    private static User user(String name, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .fullName(name)
                .username(name.toLowerCase().replace(' ', '_'))
                .role(role)
                .passwordHash(HASH)
                .emailVerified(true)
                .build();
    }
}
