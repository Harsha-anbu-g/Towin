package com.towinly.passon.controller;

import com.towinly.common.entity.User;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.UserRole;
import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.common.repository.UserRepository;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.service.KeyholderService;
import com.towinly.passon.service.PassOnAlertService;
import com.towinly.passon.service.PassOnService;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The Keyholder routes, driven through a real {@link KeyholderService} and the real
 * {@link GlobalExceptionHandler} with only the persistence mocked — so the rules are proved
 * to reach the caller as the status code and the sentence they actually see.
 *
 * The one thing every test here is really checking is that the two sides never cross. The
 * elder acts on her own list; the person she asked answers for themselves; and which side
 * the caller is on comes from the session, never from the body. An endpoint that read the
 * actor out of the request would let anybody accept a duty about a death on somebody else's
 * behalf.
 *
 * Margaret is the elder. Sarah is her daughter.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PassOnControllerKeyholderTest {

    private static final Instant TODAY = Instant.parse("2026-08-05T10:00:00Z");

    @Mock KeyholderRepository keyholderRepository;
    @Mock FamilyLinkRepository familyLinks;
    @Mock PassOnSettingsRepository settings;
    @Mock PassOnOpenRepository opens;
    @Mock UserRepository users;
    @Mock ElderProfileRepository elderProfiles;
    @Mock HelperProfileRepository helperProfiles;
    @Mock PassOnAlertService alerts;
    @Mock PassOnService passOnService;
    @Mock com.towinly.passon.service.SealedBoxService sealedBox;

    private MockMvc mockMvc;
    private Authentication margaretsSession;
    private Authentication sarahsSession;
    private User margaret;
    private User sarah;

    @BeforeEach
    void setUp() {
        margaret = user("Margaret", UserRole.ELDER);
        sarah = user("Sarah", UserRole.FAMILY);

        KeyholderService service = new KeyholderService(keyholderRepository, familyLinks, settings,
                opens, users, elderProfiles, helperProfiles, alerts,
                Clock.fixed(TODAY, ZoneOffset.UTC));
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new PassOnController(passOnService, service, sealedBox))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        margaretsSession = new UsernamePasswordAuthenticationToken(margaret.getId().toString(), null);
        sarahsSession = new UsernamePasswordAuthenticationToken(sarah.getId().toString(), null);

        when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(users.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(elderProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(helperProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(keyholderRepository.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void theElderSeesEverybodySheHasAskedAndWhetherTheyCountToday() throws Exception {
        Keyholder row = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholderRepository.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(row));
        when(familyLinks.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(link(FamilyLinkStatus.ACTIVE)));

        mockMvc.perform(get("/api/passon/keyholders").principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].personName").value("Sarah"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[0].countsToward").value(true));
    }

    @Test
    void askingSomebodyWhoIsNotOnTheFamilyListIsRefusedInPlainWords() throws Exception {
        when(familyLinks.findByElderIdAndFamilyUserId(margaret.getId(), sarah.getId()))
                .thenReturn(Optional.empty());

        mockMvc.perform(post("/api/passon/keyholders")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"personId\":\"" + sarah.getId() + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "You can only ask someone who is already on your family list."));
        verify(keyholderRepository, never()).save(any());
    }

    @Test
    void theCardOnHerOwnScreenComesFromHerOwnSessionAndNobodyElseS() throws Exception {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholderRepository.findByKeyholderIdAndStatus(sarah.getId(), KeyholderStatus.INVITED))
                .thenReturn(List.of(asked));
        when(keyholderRepository.findByOwnerIdOrderByInvitedAtAsc(margaret.getId()))
                .thenReturn(List.of(asked));
        when(settings.findById(margaret.getId())).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/passon/keyholders/asked-of-me").principal(sarahsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].ownerName").value("Margaret"))
                .andExpect(jsonPath("$[0].keyholderCount").value(1));

        // Margaret asking the same question sees nothing: she is not the one being asked.
        mockMvc.perform(get("/api/passon/keyholders/asked-of-me").principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void theElderCannotSayYesOnTheirBehalf() throws Exception {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholderRepository.findById(asked.getId())).thenReturn(Optional.of(asked));

        mockMvc.perform(post("/api/passon/keyholders/" + asked.getId() + "/respond")
                        .principal(margaretsSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accept\":true}"))
                .andExpect(status().isBadRequest());

        assertThat(asked.getStatus()).isEqualTo(KeyholderStatus.INVITED);
    }

    @Test
    void sayingYesOnHerOwnScreenIsAccepted() throws Exception {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholderRepository.findById(asked.getId())).thenReturn(Optional.of(asked));

        mockMvc.perform(post("/api/passon/keyholders/" + asked.getId() + "/respond")
                        .principal(sarahsSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accept\":true}"))
                .andExpect(status().isNoContent());

        assertThat(asked.getStatus()).isEqualTo(KeyholderStatus.ACTIVE);
    }

    @Test
    void anAnswerWithNoYesOrNoInItIsRejectedRatherThanReadAsNo() throws Exception {
        Keyholder asked = row(sarah, KeyholderStatus.INVITED);
        when(keyholderRepository.findById(asked.getId())).thenReturn(Optional.of(asked));

        mockMvc.perform(post("/api/passon/keyholders/" + asked.getId() + "/respond")
                        .principal(sarahsSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        assertThat(asked.getStatus()).isEqualTo(KeyholderStatus.INVITED);
    }

    @Test
    void steppingBackOutIsAlwaysAvailable() throws Exception {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholderRepository.findById(holding.getId())).thenReturn(Optional.of(holding));

        mockMvc.perform(post("/api/passon/keyholders/" + holding.getId() + "/resign")
                        .principal(sarahsSession))
                .andExpect(status().isNoContent());

        assertThat(holding.getStatus()).isEqualTo(KeyholderStatus.RESIGNED);
    }

    @Test
    void takingAKeyBackSaysNothingToAnybody() throws Exception {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholderRepository.findByIdAndOwnerId(holding.getId(), margaret.getId()))
                .thenReturn(Optional.of(holding));

        mockMvc.perform(delete("/api/passon/keyholders/" + holding.getId())
                        .principal(margaretsSession))
                .andExpect(status().isNoContent());

        assertThat(holding.getStatus()).isEqualTo(KeyholderStatus.REMOVED);
        verifyNoInteractions(alerts);
    }

    @Test
    void somebodyElseSKeyholderIsAPlainNotFound() throws Exception {
        Keyholder holding = row(sarah, KeyholderStatus.ACTIVE);
        when(keyholderRepository.findByIdAndOwnerId(holding.getId(), sarah.getId()))
                .thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/passon/keyholders/" + holding.getId())
                        .principal(sarahsSession))
                .andExpect(status().isNotFound());
    }

    // ── helpers ──

    private Keyholder row(User who, KeyholderStatus status) {
        return Keyholder.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .keyholder(who)
                .status(status)
                .invitedAt(LocalDateTime.of(2026, 8, 1, 9, 0))
                .build();
    }

    private FamilyLink link(FamilyLinkStatus status) {
        return FamilyLink.builder()
                .id(UUID.randomUUID())
                .elder(margaret)
                .familyUser(sarah)
                .initiatedBy(margaret)
                .status(status)
                .build();
    }

    private static User user(String name, UserRole role) {
        return User.builder()
                .id(UUID.randomUUID())
                .fullName(name)
                .username(name.toLowerCase())
                .email(name.toLowerCase() + "@test.com")
                .role(role)
                .build();
    }
}
