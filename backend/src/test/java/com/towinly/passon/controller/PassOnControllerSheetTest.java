package com.towinly.passon.controller;

import com.towinly.common.entity.User;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.SealedKind;
import com.towinly.common.enums.UserRole;
import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.common.repository.UserRepository;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.security.SealedRevealRateLimiter;
import com.towinly.passon.service.KeyholderService;
import com.towinly.passon.service.PassOnAlertService;
import com.towinly.passon.service.PassOnService;
import com.towinly.passon.service.SealedBoxService;
import com.towinly.passon.service.SealedCryptoService;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The saved copy — the one page the elder takes out of the app and keeps somewhere her family
 * would think to look.
 *
 * <h2>What this file is really guarding</h2>
 * The sheet exists to be carried out of Towinly: downloaded, sent on, left in a drawer, read by
 * somebody in the week after a death. Every other surface in this feature can be argued about;
 * this one leaves. So the rule that matters is not "the body is not displayed" but
 * <b>the body is never decrypted on this path at all</b> — {@code crypto.open} is never called,
 * only {@code crypto.openLabel}. A plaintext that is never produced cannot be logged, cached,
 * serialised or carried into a file by a later change. That is asserted below as a call that
 * must not happen, not as a field that must be absent.
 *
 * <p>Margaret is the elder. Sarah, David and Ruth are the three people she asked.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PassOnControllerSheetTest {

    /** 5 August 2026, so "prepared today" has a date a human can read in the assertion. */
    private static final Instant TODAY = Instant.parse("2026-08-05T10:00:00Z");

    /**
     * What one sealed item actually says. If this string ever reaches the response, the sheet
     * has become a second door into the box.
     */
    private static final String THE_SECRET = "Account 4471 at the credit union on Rue Principale";

    @Mock SealedItemRepository sealedItems;
    @Mock PassOnSettingsRepository settings;
    @Mock PassOnOpenRepository opens;
    @Mock UserRepository users;
    @Mock SealedCryptoService crypto;
    @Mock PasswordEncoder passwordEncoder;
    @Mock PassOnAlertService alerts;
    @Mock KeyholderRepository keyholderRepository;
    @Mock FamilyLinkRepository familyLinks;
    @Mock ElderProfileRepository elderProfiles;
    @Mock HelperProfileRepository helperProfiles;
    @Mock PassOnService passOnService;

    private MockMvc mockMvc;
    private User margaret;
    private User sarah;
    private User david;
    private User ruth;
    private Authentication margaretsSession;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(TODAY, ZoneOffset.UTC);
        KeyholderService keyholders = new KeyholderService(keyholderRepository, familyLinks,
                settings, opens, users, elderProfiles, helperProfiles, alerts, clock);
        SealedBoxService sealedBox = new SealedBoxService(sealedItems, settings, opens, users,
                crypto, passwordEncoder, new SealedRevealRateLimiter(clock), alerts, keyholders, clock);

        mockMvc = MockMvcBuilders
                .standaloneSetup(new PassOnController(passOnService, keyholders, sealedBox))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        margaret = user("Margaret", UserRole.ELDER);
        sarah = user("Sarah", UserRole.FAMILY);
        david = user("David", UserRole.FAMILY);
        ruth = user("Ruth", UserRole.FAMILY);
        margaretsSession = new UsernamePasswordAuthenticationToken(margaret.getId().toString(), null);

        when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(elderProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(helperProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(crypto.isAvailable()).thenReturn(true);
        when(settings.save(any())).thenAnswer(call -> call.getArgument(0));
        when(sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(margaret.getId()))
                .thenReturn(List.of());
        when(keyholderRepository.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of());
        when(settings.findById(margaret.getId())).thenReturn(Optional.empty());
    }

    @Test
    void theSheetNamesWhatIsInTheBoxAndNeverOpensIt() throws Exception {
        SealedItem item = sealedItem(SealedKind.MONEY);
        when(sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(margaret.getId()))
                .thenReturn(List.of(item));
        when(crypto.openLabel(any(), any(), any())).thenReturn("Where the money is");

        mockMvc.perform(get("/api/passon/sheet").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerName").value("Margaret"))
                .andExpect(jsonPath("$.items[0].label").value("Where the money is"))
                .andExpect(jsonPath("$.items[0].kindHint").value("MONEY"))
                // Not "the body field is empty" — there is no body anywhere in what was sent.
                .andExpect(content().string(not(containsString(THE_SECRET))));

        // The whole guarantee, as a call that must never happen. openLabel unwraps the name and
        // stops; open() is the only method that turns a body back into readable text.
        verify(crypto, never()).open(any(), any(), any());
    }

    @Test
    void anEmptyBoxNeverReachesForTheKeyAtAll() throws Exception {
        mockMvc.perform(get("/api/passon/sheet").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());

        verify(crypto, never()).openLabel(any(), any(), any());
        verify(crypto, never()).open(any(), any(), any());
    }

    @Test
    void theSheetSaysWhoCanOpenItAndHowManyMustAgree() throws Exception {
        when(settings.findById(margaret.getId())).thenReturn(Optional.of(armed()));
        when(keyholderRepository.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(
                        keyholderRow(sarah, KeyholderStatus.ACTIVE),
                        keyholderRow(david, KeyholderStatus.INVITED),
                        keyholderRow(ruth, KeyholderStatus.DECLINED)));
        onFamilyList(sarah, david, ruth);

        mockMvc.perform(get("/api/passon/sheet").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.armed").value(true))
                .andExpect(jsonPath("$.approvalsNeeded").value(2))
                .andExpect(jsonPath("$.keyholderTarget").value(3))
                .andExpect(jsonPath("$.keyholders[0].personName").value("Sarah"))
                .andExpect(jsonPath("$.keyholders[0].status").value("ACTIVE"))
                // Re-derived here as everywhere else: only Sarah actually holds a key today.
                .andExpect(jsonPath("$.keyholders[0].countsToward").value(true))
                .andExpect(jsonPath("$.keyholders[1].personName").value("David"))
                .andExpect(jsonPath("$.keyholders[1].countsToward").value(false))
                .andExpect(jsonPath("$.keyholders[2].personName").value("Ruth"));
    }

    @Test
    void takingACopyOutOfTheAppIsWrittenOnHerOwnRecord() throws Exception {
        when(settings.findById(margaret.getId())).thenReturn(Optional.of(armed()));

        mockMvc.perform(post("/api/passon/sheet/saved").principal(margaretsSession))
                .andExpect(status().isNoContent());

        ArgumentCaptor<PassOnSettings> saved = ArgumentCaptor.forClass(PassOnSettings.class);
        verify(settings).save(saved.capture());
        assertThat(saved.getValue().getSheetSavedAt())
                .isEqualTo(LocalDateTime.ofInstant(TODAY, ZoneOffset.UTC));
    }

    /**
     * She can take a copy before she has arranged anything — there is simply nowhere to write it
     * down, because the row that would hold the date is created when she sets the box up. The
     * download must not fail on that account.
     */
    @Test
    void takingACopyBeforeSheHasArrangedAnythingStillSucceedsAndRecordsNothing() throws Exception {
        mockMvc.perform(post("/api/passon/sheet/saved").principal(margaretsSession))
                .andExpect(status().isNoContent());

        verify(settings, never()).save(any());
    }

    /**
     * "You have not saved a copy yet" has to be true when it is said. It is the only honest way
     * to press the point that Towinly must not be her only copy, and a page that says it to
     * somebody who saved one last week teaches her to ignore the line.
     */
    @Test
    void theSheetSaysWhetherSheHasEverTakenACopyOut() throws Exception {
        mockMvc.perform(get("/api/passon/sheet").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastSavedAt").doesNotExist());

        PassOnSettings row = armed();
        row.setSheetSavedAt(LocalDateTime.of(2026, 8, 2, 9, 30));
        when(settings.findById(margaret.getId())).thenReturn(Optional.of(row));

        mockMvc.perform(get("/api/passon/sheet").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastSavedAt").exists());
    }

    // ── plumbing ──

    private SealedItem sealedItem(SealedKind kind) {
        byte[] opaque = THE_SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return SealedItem.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .labelCipher(new byte[]{1, 2, 3})
                .labelIv(new byte[]{4, 5, 6})
                .kindHint(kind)
                // Deliberately the real sentence rather than random bytes: if any future change
                // decrypts on this path, the assertion above sees the words themselves.
                .bodyCipher(opaque)
                .bodyIv(new byte[]{7, 8, 9})
                .wrappedKey(new byte[]{10, 11, 12})
                .keyVersion(SealedCryptoService.CURRENT_KEY_VERSION)
                .byteSize(opaque.length)
                .sortOrder(0)
                .createdAt(LocalDateTime.of(2026, 6, 1, 12, 0))
                .build();
    }

    private Keyholder keyholderRow(User person, KeyholderStatus status) {
        return Keyholder.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .keyholder(person)
                .status(status)
                .invitedAt(LocalDateTime.of(2026, 6, 1, 9, 0))
                .respondedAt(status == KeyholderStatus.INVITED ? null : LocalDateTime.of(2026, 6, 2, 9, 0))
                .build();
    }

    private PassOnSettings armed() {
        return PassOnSettings.builder()
                .ownerId(margaret.getId())
                .approvalsNeeded((short) 2)
                .keyholderTarget((short) 3)
                .armedAt(LocalDateTime.of(2026, 8, 1, 9, 0))
                .coolingOffUntil(LocalDateTime.of(2026, 8, 8, 9, 0))
                .build();
    }

    /**
     * Her live family list. Membership of it is half of what makes somebody count toward the
     * quorum — the other half is their own ACTIVE answer — and both are re-derived on every
     * read rather than stored, so the sheet can never name a key that came off the list last
     * night.
     */
    private void onFamilyList(User... familyMembers) {
        when(familyLinks.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(java.util.Arrays.stream(familyMembers)
                        .map(person -> FamilyLink.builder()
                                .id(UUID.randomUUID())
                                .elder(margaret)
                                .familyUser(person)
                                .status(FamilyLinkStatus.ACTIVE)
                                .build())
                        .toList());
    }

    private static User user(String name, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .fullName(name)
                .username(name.toLowerCase())
                .role(role)
                .passwordHash("$2a$10$notarealbcrypthashbutlongenough")
                .emailVerified(true)
                .build();
    }
}
