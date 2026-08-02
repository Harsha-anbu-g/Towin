package com.towinly.passon.controller;

import com.towinly.common.entity.User;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.UserRole;
import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.common.repository.UserRepository;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.security.SealedRevealRateLimiter;
import com.towinly.passon.service.KeyholderService;
import com.towinly.passon.service.ReleaseGate;
import com.towinly.passon.service.PassOnAlertService;
import com.towinly.passon.service.PassOnService;
import com.towinly.passon.service.ReleaseContact;
import com.towinly.passon.service.SealedBoxService;
import com.towinly.passon.service.SealedCryptoService;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
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

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The three setup routes, driven through a real {@link SealedBoxService} and the real
 * {@link GlobalExceptionHandler} with only the persistence mocked.
 *
 * <h2>Why the sentences are asserted here and not only in the service</h2>
 * {@code GlobalExceptionHandler} does not pass exception text through — it looks the message
 * up in an allowlist and falls back to <em>"Invalid request."</em> for anything it does not
 * recognise. So a refusal can be perfectly worded in the service and still reach the elder as
 * two useless words. On the last screen of a flow about her own death, "Invalid request." is
 * worse than useless: she cannot tell whether she did something wrong, whether her writing was
 * saved, or what to try next. Every refusal below is asserted as the sentence she actually
 * reads.
 *
 * <p>Margaret is the elder. Sarah, David and Ruth are the three people she picks.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PassOnControllerSetupTest {

    /** 5 August 2026. Seven days on is 12 August, the same day the spec uses. */
    private static final Instant TODAY = Instant.parse("2026-08-05T10:00:00Z");

    /** What a deployment that has done its homework has configured. */
    private static final String RELEASE_CONTACT_EMAIL = "sealedbox@example.org";

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
                settings, opens, users, elderProfiles, helperProfiles, alerts, new ReleaseGate(settings), clock);
        SealedBoxService sealedBox = new SealedBoxService(sealedItems, settings, opens, users,
                crypto, passwordEncoder, new SealedRevealRateLimiter(clock), alerts, keyholders,
                new ReleaseContact(RELEASE_CONTACT_EMAIL), new ReleaseGate(settings), clock);

        mockMvc = MockMvcBuilders
                .standaloneSetup(new PassOnController(passOnService, keyholders, sealedBox))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        margaret = user("Margaret", UserRole.ELDER, true);
        sarah = user("Sarah", UserRole.FAMILY, true);
        david = user("David", UserRole.FAMILY, true);
        ruth = user("Ruth", UserRole.FAMILY, true);
        margaretsSession = new UsernamePasswordAuthenticationToken(margaret.getId().toString(), null);

        when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(users.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(users.findById(david.getId())).thenReturn(Optional.of(david));
        when(users.findById(ruth.getId())).thenReturn(Optional.of(ruth));
        when(elderProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(helperProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(crypto.isAvailable()).thenReturn(true);
        when(keyholderRepository.save(any())).thenAnswer(call -> call.getArgument(0));
        when(settings.save(any())).thenAnswer(call -> call.getArgument(0));
        onFamilyList(sarah);
        onFamilyList(david);
        onFamilyList(ruth);
    }

    @Test
    void theSetupScreenIsHandedTheTwoSentencesItMustShowHer() throws Exception {
        when(settings.findById(margaret.getId())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/passon/setup").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.armed").value(false))
                .andExpect(jsonPath("$.emailConfirmed").value(true))
                .andExpect(jsonPath("$.notAWillAck").value("I understand this is not a will."))
                .andExpect(jsonPath("$.keyTruthAck").value(SealedBoxService.KEY_TRUTH_ACK));
    }

    @Test
    void finishingAsksEverybodyAndStartsTheSevenDays() throws Exception {
        when(settings.findById(margaret.getId())).thenReturn(Optional.empty());
        when(keyholderRepository.findByOwnerIdAndKeyholderId(any(), any())).thenReturn(Optional.empty());
        when(keyholderRepository.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of());

        mockMvc.perform(post("/api/passon/arm").principal(margaretsSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(armBody(SealedBoxService.NOT_A_WILL_ACK, SealedBoxService.KEY_TRUTH_ACK)))
                .andExpect(status().isNoContent());

        // One alert per person, each naming them. An alert saying only "someone" would let
        // exactly the relative this is meant to expose stay anonymous.
        verify(alerts).keyholderAsked(margaret, "Sarah");
        verify(alerts).keyholderAsked(margaret, "David");
        verify(alerts).keyholderAsked(margaret, "Ruth");
        verify(alerts).settingsChanged(margaret);
    }

    @Test
    void anUnconfirmedEmailIsRefusedInWordsSheCanActOn() throws Exception {
        margaret.setEmailVerified(false);

        mockMvc.perform(post("/api/passon/arm").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(armBody(SealedBoxService.NOT_A_WILL_ACK, SealedBoxService.KEY_TRUTH_ACK)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Please confirm your email address before you set this up. One day it is how "
                                + "we would reach you about your box, and we need to know it works."));

        verify(settings, never()).save(any());
        verify(keyholderRepository, never()).save(any());
    }

    @Test
    void anUntickedBoxIsRefusedInWordsSheCanActOn() throws Exception {
        mockMvc.perform(post("/api/passon/arm").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(armBody(SealedBoxService.NOT_A_WILL_ACK, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please tick both boxes to finish."));

        // Nobody was asked anything on a request that was refused.
        verify(keyholderRepository, never()).save(any());
        verifyNoInteractions(alerts);
    }

    @Test
    void twoPeopleIsRefusedBecauseAThreePersonPoolIsTheSmallestThatWorks() throws Exception {
        String body = "{\"personIds\":[\"" + sarah.getId() + "\",\"" + david.getId() + "\"],"
                + "\"approvalsNeeded\":2,"
                + "\"notAWillAck\":" + quoted(SealedBoxService.NOT_A_WILL_ACK) + ","
                + "\"keyTruthAck\":" + quoted(SealedBoxService.KEY_TRUTH_ACK) + "}";

        mockMvc.perform(post("/api/passon/arm").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Please pick at least three people, and no more than five."));
    }

    @Test
    void needingAllThreeToAgreeIsRefusedBecauseUnanimityIsADeadlock() throws Exception {
        // The first Keyholder who is unreachable — or who has died themselves — would
        // otherwise keep the box shut forever.
        String body = "{\"personIds\":[\"" + sarah.getId() + "\",\"" + david.getId() + "\",\""
                + ruth.getId() + "\"],\"approvalsNeeded\":3,"
                + "\"notAWillAck\":" + quoted(SealedBoxService.NOT_A_WILL_ACK) + ","
                + "\"keyTruthAck\":" + quoted(SealedBoxService.KEY_TRUTH_ACK) + "}";

        mockMvc.perform(post("/api/passon/arm").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "The number who must agree has to be at least two, and always fewer than "
                                + "the number of people you picked."));
    }

    @Test
    void theUndoTapSaysNothingToAnybody() throws Exception {
        when(settings.findById(margaret.getId())).thenReturn(Optional.of(armed()));
        when(keyholderRepository.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).thenReturn(List.of());

        mockMvc.perform(post("/api/passon/undo").principal(margaretsSession))
                .andExpect(status().isNoContent());

        verify(settings).deleteByOwnerId(margaret.getId());
        // The person whose idea the setup was is precisely who must not be told she
        // reversed it. See SealedBoxService.undoSetup before adding any alert here.
        verifyNoInteractions(alerts);
    }

    @Test
    void undoingTooLateIsRefusedInWordsSheCanActOn() throws Exception {
        PassOnSettings settled = armed();
        settled.setCoolingOffUntil(LocalDateTime.of(2026, 8, 4, 10, 0));
        when(settings.findById(margaret.getId())).thenReturn(Optional.of(settled));

        mockMvc.perform(post("/api/passon/undo").principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "The seven days have passed, so this is settled. You can still take "
                                + "anybody's key back whenever you like."));
    }

    // ── fixtures ──

    private String armBody(String notAWill, String keyTruth) {
        return "{\"personIds\":[\"" + sarah.getId() + "\",\"" + david.getId() + "\",\""
                + ruth.getId() + "\"],\"approvalsNeeded\":2,"
                + "\"notAWillAck\":" + quoted(notAWill) + ","
                + "\"keyTruthAck\":" + quoted(keyTruth) + "}";
    }

    /** JSON-quotes a sentence, or emits null for a box she left unticked. */
    private static String quoted(String text) {
        if (text == null) return "null";
        return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
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

    private void onFamilyList(User familyMember) {
        when(familyLinks.findByElderIdAndFamilyUserId(margaret.getId(), familyMember.getId()))
                .thenReturn(Optional.of(FamilyLink.builder()
                        .id(UUID.randomUUID())
                        .elder(margaret)
                        .familyUser(familyMember)
                        .status(FamilyLinkStatus.ACTIVE)
                        .build()));
    }

    private static User user(String name, UserRole role, boolean emailConfirmed) {
        return User.builder()
                .id(UUID.randomUUID())
                .fullName(name)
                .username(name.toLowerCase())
                .role(role)
                .passwordHash("$2a$10$notarealbcrypthashbutlongenough")
                .emailVerified(emailConfirmed)
                .build();
    }
}
