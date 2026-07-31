package com.towinly.passon.controller;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.UserRole;
import com.towinly.common.exception.GlobalExceptionHandler;
import com.towinly.common.repository.UserRepository;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.service.PassOnService;
import com.towinly.passon.service.PassOnVisibilityService;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The Story box and Letters API, driven through a real {@link PassOnService} and the real
 * {@link GlobalExceptionHandler} with only the persistence mocked — so a rule that lives in the
 * service is proved to reach the caller as the status code and the sentence they actually see,
 * rather than as an exception a mocked service was told to throw.
 *
 * Margaret owns the page. Sarah is her daughter, Tom a helper.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PassOnControllerTest {

    @Mock PassOnItemRepository items;
    @Mock UserRepository users;
    @Mock ElderProfileRepository elderProfiles;
    @Mock HelperProfileRepository helperProfiles;
    @Mock PassOnVisibilityService visibility;
    @Mock com.towinly.passon.service.KeyholderService keyholders;

    private MockMvc mockMvc;
    private Authentication margaretsSession;
    private User margaret, sarah, tom;

    @BeforeEach
    void setUp() {
        margaret = user("Margaret", UserRole.ELDER);
        sarah = user("Sarah", UserRole.FAMILY);
        tom = user("Tom", UserRole.HELPER);

        PassOnService service =
                new PassOnService(items, users, elderProfiles, helperProfiles, visibility);
        // Keyholders have their own test class; nothing here touches them.
        mockMvc = MockMvcBuilders.standaloneSetup(new PassOnController(service, keyholders))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        margaretsSession = new UsernamePasswordAuthenticationToken(margaret.getId().toString(), null);

        when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(users.findById(sarah.getId())).thenReturn(Optional.of(sarah));
        when(users.findById(tom.getId())).thenReturn(Optional.of(tom));
        when(elderProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(helperProfiles.findByUserId(any())).thenReturn(Optional.empty());
        // Nothing is readable unless a test says so.
        when(visibility.canRead(any(PassOnItem.class), any())).thenReturn(false);
        when(items.save(any())).thenAnswer(call -> {
            PassOnItem saved = call.getArgument(0);
            if (saved.getId() == null) saved.setId(UUID.randomUUID());
            return saved;
        });
    }

    private User user(String name, UserRole role) {
        return User.builder().id(UUID.randomUUID()).fullName(name).username(name.toLowerCase()).role(role).build();
    }

    private PassOnItem story(String title, PassOnAudience audience) {
        return PassOnItem.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .kind(PassOnKind.STORY)
                .title(title)
                .body("It snowed for four days.")
                .audience(audience)
                .releaseWhen(PassOnRelease.NOW)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private PassOnItem letterTo(User person, String title) {
        PassOnItem letter = story(title, PassOnAudience.PERSON);
        letter.setKind(PassOnKind.LETTER);
        letter.setAudienceUser(person);
        return letter;
    }

    private PassOnItem lastSaved() {
        ArgumentCaptor<PassOnItem> captor = ArgumentCaptor.forClass(PassOnItem.class);
        verify(items).save(captor.capture());
        return captor.getValue();
    }

    // ── writing ──

    @Test
    @DisplayName("a letter held until after the writer is gone is refused, in plain words, and nothing is saved")
    void refusesALetterHeldUntilAfterAndSavesNothing() throws Exception {
        String body = """
                {"kind":"LETTER","title":"What I wish I had told your father",
                 "body":"You were always kind.","audience":"PERSON",
                 "audienceUserId":"%s","releaseWhen":"AFTER"}
                """.formatted(sarah.getId());

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Every letter here can be read today. We are still building the part where a "
                                + "letter opens after you are gone, and we will not offer it until we are sure it works."));

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("saves a story, and the writer is taken from the token and never from the body")
    void savesAStoryWithTheOwnerFromTheTokenNotTheBody() throws Exception {
        String body = """
                {"ownerId":"%s","kind":"STORY","title":"The winter we lost the roof",
                 "body":"It snowed for four days.","audience":"EVERYONE"}
                """.formatted(tom.getId());

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("The winter we lost the roof"))
                .andExpect(jsonPath("$.audience").value("EVERYONE"));

        PassOnItem saved = lastSaved();
        assertThat(saved.getOwner().getId()).isEqualTo(margaret.getId());
        assertThat(saved.getReleaseWhen()).isEqualTo(PassOnRelease.NOW);
    }

    @Test
    @DisplayName("a letter must go to one person")
    void aLetterMustBeAddressedToOnePerson() throws Exception {
        String body = """
                {"kind":"LETTER","title":"To all of you","body":"Be kind.","audience":"FAMILY"}
                """;

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("A letter goes to one person, and only that person."));

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("choosing one person without naming anyone is refused")
    void aLetterMustNameThePerson() throws Exception {
        String body = """
                {"kind":"LETTER","title":"For you","body":"Be kind.","audience":"PERSON"}
                """;

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please choose the one person this is for."));

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("a story for anyone never keeps a named person, whatever the page sent")
    void aStoryForEveryoneNeverKeepsANamedPerson() throws Exception {
        // She picked Sarah, then changed her mind to "Anyone". A stale name left on the row
        // would break the database's own ck_passon_person rule.
        String body = """
                {"kind":"STORY","title":"The winter we lost the roof","body":"It snowed.",
                 "audience":"EVERYONE","audienceUserId":"%s"}
                """.formatted(sarah.getId());

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        assertThat(lastSaved().getAudienceUser()).isNull();
    }

    @Test
    @DisplayName("only an elder can write on this page")
    void onlyAnElderCanWriteHere() throws Exception {
        Authentication tomsSession = new UsernamePasswordAuthenticationToken(tom.getId().toString(), null);
        String body = """
                {"kind":"STORY","title":"My story","body":"Something.","audience":"EVERYONE"}
                """;

        mockMvc.perform(post("/api/passon/items")
                        .principal(tomsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only elders can write on this page."));

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("a story needs a name and some words")
    void theTitleAndTheWordsAreRequired() throws Exception {
        String body = """
                {"kind":"STORY","title":"  ","body":"","audience":"EVERYONE"}
                """;

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        verify(items, never()).save(any());
    }

    // ── her own page ──

    @Test
    @DisplayName("her own page returns stories and letters apart from each other")
    void mineReturnsStoriesAndLettersSeparately() throws Exception {
        when(items.findByOwnerIdAndKindOrderByCreatedAtDesc(margaret.getId(), PassOnKind.STORY))
                .thenReturn(List.of(story("The winter we lost the roof", PassOnAudience.EVERYONE)));
        when(items.findByOwnerIdAndKindOrderByCreatedAtDesc(margaret.getId(), PassOnKind.LETTER))
                .thenReturn(List.of(letterTo(sarah, "What I wish I had told your father")));

        mockMvc.perform(get("/api/passon/mine").principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stories[0].title").value("The winter we lost the roof"))
                .andExpect(jsonPath("$.letters[0].title").value("What I wish I had told your father"))
                .andExpect(jsonPath("$.letters[0].audienceUserName").value("Sarah"));
    }

    @Test
    @DisplayName("editing something that is not hers is a not-found, not a read")
    void editingSomethingThatIsNotMineIsANotFound() throws Exception {
        UUID someoneElsesItem = UUID.randomUUID();
        when(items.findByIdAndOwnerId(someoneElsesItem, margaret.getId())).thenReturn(Optional.empty());
        String body = """
                {"kind":"STORY","title":"Mine now","body":"Something.","audience":"EVERYONE"}
                """;

        mockMvc.perform(put("/api/passon/items/{id}", someoneElsesItem)
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound());

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("editing changes the words and who may see them")
    void updateChangesTheWordsAndTheAudience() throws Exception {
        PassOnItem existing = story("The winter we lost the roof", PassOnAudience.EVERYONE);
        when(items.findByIdAndOwnerId(existing.getId(), margaret.getId())).thenReturn(Optional.of(existing));
        String body = """
                {"kind":"STORY","title":"The winter we lost the roof",
                 "body":"It snowed for five days.","audience":"FAMILY"}
                """;

        mockMvc.perform(put("/api/passon/items/{id}", existing.getId())
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.audience").value("FAMILY"));

        PassOnItem saved = lastSaved();
        assertThat(saved.getBody()).isEqualTo("It snowed for five days.");
        assertThat(saved.getKind()).isEqualTo(PassOnKind.STORY);
    }

    @Test
    @DisplayName("deleting something that is not hers is a not-found, and removes nothing")
    void deletingSomethingThatIsNotMineIsANotFound() throws Exception {
        UUID someoneElsesItem = UUID.randomUUID();
        when(items.findByIdAndOwnerId(someoneElsesItem, margaret.getId())).thenReturn(Optional.empty());

        mockMvc.perform(delete("/api/passon/items/{id}", someoneElsesItem).principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());

        verify(items, never()).delete(any());
    }

    @Test
    @DisplayName("she can take her own story down")
    void deleteRemovesMyOwnItem() throws Exception {
        PassOnItem existing = story("The winter we lost the roof", PassOnAudience.EVERYONE);
        when(items.findByIdAndOwnerId(existing.getId(), margaret.getId())).thenReturn(Optional.of(existing));

        mockMvc.perform(delete("/api/passon/items/{id}", existing.getId()).principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());

        verify(items).delete(existing);
    }

    // ── what a visitor sees ──

    @Test
    @DisplayName("a visitor sees only what she addressed to them")
    void theVisitorSeesOnlyWhatTheyMayRead() throws Exception {
        PassOnItem open = story("The winter we lost the roof", PassOnAudience.EVERYONE);
        PassOnItem forFamilyOnly = story("What I wish I had told your father", PassOnAudience.FAMILY);
        when(items.findByOwnerIdOrderByCreatedAtDesc(margaret.getId()))
                .thenReturn(List.of(open, forFamilyOnly));
        when(visibility.canRead(open, tom.getId())).thenReturn(true);
        when(visibility.canRead(forFamilyOnly, tom.getId())).thenReturn(false);
        Authentication tomsSession = new UsernamePasswordAuthenticationToken(tom.getId().toString(), null);

        mockMvc.perform(get("/api/passon/from/{ownerId}", margaret.getId()).principal(tomsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerName").value("Margaret"))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].title").value("The winter we lost the roof"));
    }

    @Test
    @DisplayName("a letter is stamped the first time the person it names reads it")
    void aLetterIsStampedTheFirstTimeItsPersonReadsIt() throws Exception {
        PassOnItem letter = letterTo(sarah, "What I wish I had told your father");
        when(items.findByOwnerIdOrderByCreatedAtDesc(margaret.getId())).thenReturn(List.of(letter));
        when(visibility.canRead(letter, sarah.getId())).thenReturn(true);
        Authentication sarahsSession = new UsernamePasswordAuthenticationToken(sarah.getId().toString(), null);

        mockMvc.perform(get("/api/passon/from/{ownerId}", margaret.getId()).principal(sarahsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        assertThat(lastSaved().getFirstReadAt()).isNotNull();
    }

    @Test
    @DisplayName("a letter already read keeps the day it was first read")
    void anAlreadyStampedLetterKeepsItsFirstDate() throws Exception {
        PassOnItem letter = letterTo(sarah, "What I wish I had told your father");
        LocalDateTime june3rd = LocalDateTime.of(2026, 6, 3, 10, 0);
        letter.setFirstReadAt(june3rd);
        when(items.findByOwnerIdOrderByCreatedAtDesc(margaret.getId())).thenReturn(List.of(letter));
        when(visibility.canRead(letter, sarah.getId())).thenReturn(true);
        Authentication sarahsSession = new UsernamePasswordAuthenticationToken(sarah.getId().toString(), null);

        mockMvc.perform(get("/api/passon/from/{ownerId}", margaret.getId()).principal(sarahsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        assertThat(letter.getFirstReadAt()).isEqualTo(june3rd);
        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("the writer's own visit is never a delivery, even to a letter with her own name on it")
    void theOwnerReadingHerOwnPageNeverStampsALetter() throws Exception {
        // Her own name on it is the only case where "who is it for" and "who is reading" are
        // the same person, so it is the case that pins the rule: reading is not delivering.
        PassOnItem letter = letterTo(margaret, "What I wish I had told your father");
        when(items.findByOwnerIdOrderByCreatedAtDesc(margaret.getId())).thenReturn(List.of(letter));
        when(visibility.canRead(letter, margaret.getId())).thenReturn(true);

        mockMvc.perform(get("/api/passon/from/{ownerId}", margaret.getId()).principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        assertThat(letter.getFirstReadAt()).isNull();
        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("a page belonging to nobody is a not-found")
    void readingAPageThatDoesNotExistIsANotFound() throws Exception {
        UUID nobody = UUID.randomUUID();
        when(users.findById(nobody)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/passon/from/{ownerId}", nobody).principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }
}
