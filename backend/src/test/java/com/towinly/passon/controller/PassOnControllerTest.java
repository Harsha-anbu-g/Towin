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
    /** Nobody has died unless a test says so — every owner is alive and unreleased. */
    @Mock com.towinly.passon.service.ReleaseGate releases;
    @Mock com.towinly.passon.service.KeyholderService keyholders;
    @Mock com.towinly.passon.service.SealedBoxService sealedBox;

    private MockMvc mockMvc;
    private Authentication margaretsSession;
    private User margaret, sarah, tom;

    @BeforeEach
    void setUp() {
        margaret = user("Margaret", UserRole.ELDER);
        sarah = user("Sarah", UserRole.FAMILY);
        tom = user("Tom", UserRole.HELPER);

        PassOnService service =
                new PassOnService(items, users, elderProfiles, helperProfiles, visibility, releases);
        // Keyholders and the Sealed box setup have their own test classes; nothing here
        // touches either.
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new PassOnController(service, keyholders, sealedBox))
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
    @DisplayName("a letter held until after the writer is gone is written down as she asked")
    void savesALetterHeldUntilTheWriterIsGone() throws Exception {
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.releaseWhen").value("AFTER"));

        assertThat(lastSaved().getReleaseWhen()).isEqualTo(PassOnRelease.AFTER);
    }

    @Test
    @DisplayName("a story cannot be held back until after she is gone, and nothing is saved")
    void refusesAStoryHeldUntilAfterAndSavesNothing() throws Exception {
        // The database says the same thing (ck_passon_story), but a constraint violation is a
        // 500 and a shrug. She reads a sentence instead.
        String body = """
                {"kind":"STORY","title":"The winter we lost the roof","body":"It snowed.",
                 "audience":"EVERYONE","releaseWhen":"AFTER"}
                """;

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "A story is for people to read now. Only a letter can be kept until after "
                                + "you are gone."));

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
    @DisplayName("her own page shows a letter held until after she is gone, long before any release")
    void herOwnPageShowsALetterHeldUntilAfterSheIsGone() throws Exception {
        PassOnItem held = letterTo(sarah, "What I wish I had told your father");
        held.setReleaseWhen(PassOnRelease.AFTER);
        when(items.findByOwnerIdAndKindOrderByCreatedAtDesc(margaret.getId(), PassOnKind.STORY))
                .thenReturn(List.of());
        when(items.findByOwnerIdAndKindOrderByCreatedAtDesc(margaret.getId(), PassOnKind.LETTER))
                .thenReturn(List.of(held));

        mockMvc.perform(get("/api/passon/mine").principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.letters.length()").value(1))
                .andExpect(jsonPath("$.letters[0].title").value("What I wish I had told your father"))
                .andExpect(jsonPath("$.letters[0].releaseWhen").value("AFTER"));
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

    // ── a letter held until after she is gone, while she is still here ──

    @Test
    @DisplayName("she can change a letter held until after she is gone into one to read today")
    void sheCanTurnALetterHeldUntilAfterIntoOneToReadToday() throws Exception {
        PassOnItem held = letterTo(sarah, "What I wish I had told your father");
        held.setReleaseWhen(PassOnRelease.AFTER);
        when(items.findByIdAndOwnerId(held.getId(), margaret.getId())).thenReturn(Optional.of(held));
        String body = """
                {"kind":"LETTER","title":"What I wish I had told your father",
                 "body":"You were always kind.","audience":"PERSON",
                 "audienceUserId":"%s","releaseWhen":"NOW"}
                """.formatted(sarah.getId());

        mockMvc.perform(put("/api/passon/items/{id}", held.getId())
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.releaseWhen").value("NOW"));

        assertThat(lastSaved().getReleaseWhen()).isEqualTo(PassOnRelease.NOW);
    }

    @Test
    @DisplayName("an edit that says nothing about the timing leaves a held letter held")
    void anEditThatSaysNothingAboutTimingLeavesAHeldLetterHeld() throws Exception {
        // She is fixing a typo, not changing her mind about when Sarah may read it. A body with
        // no releaseWhen in it must not quietly hand the letter over while she is still alive.
        PassOnItem held = letterTo(sarah, "What I wish I had told your father");
        held.setReleaseWhen(PassOnRelease.AFTER);
        when(items.findByIdAndOwnerId(held.getId(), margaret.getId())).thenReturn(Optional.of(held));
        String body = """
                {"kind":"LETTER","title":"What I wish I had told your father",
                 "body":"You were always kind, and I meant it.","audience":"PERSON",
                 "audienceUserId":"%s"}
                """.formatted(sarah.getId());

        mockMvc.perform(put("/api/passon/items/{id}", held.getId())
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.releaseWhen").value("AFTER"));

        PassOnItem saved = lastSaved();
        assertThat(saved.getBody()).isEqualTo("You were always kind, and I meant it.");
        assertThat(saved.getReleaseWhen()).describedAs("the timing she never mentioned")
                .isEqualTo(PassOnRelease.AFTER);
    }

    @Test
    @DisplayName("she can take a letter held until after she is gone back down")
    void sheCanTakeDownALetterHeldUntilAfterSheIsGone() throws Exception {
        PassOnItem held = letterTo(sarah, "What I wish I had told your father");
        held.setReleaseWhen(PassOnRelease.AFTER);
        when(items.findByIdAndOwnerId(held.getId(), margaret.getId())).thenReturn(Optional.of(held));

        mockMvc.perform(delete("/api/passon/items/{id}", held.getId())
                        .principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNoContent());

        verify(items).delete(held);
    }

    // ── and after somebody has released her ──
    //
    // Every test below has somebody signed in as a woman who has died. That is not a far-fetched
    // scenario, it is the ordinary one: her family have her phone and her mailbox, and after the
    // release nobody is watching the account at all. So the rule is not "released letters are
    // frozen", it is "a released owner writes nothing" — the whole surface, not the items on it.

    /** Somebody has run the release procedure for Margaret by hand. */
    private void margaretHasBeenReleased() {
        when(releases.isReleased(margaret.getId())).thenReturn(true);
    }

    @Test
    @DisplayName("a letter that has already been passed on cannot be rewritten")
    void aLetterAlreadyPassedOnCannotBeEdited() throws Exception {
        // Sarah has read it. Editing it now would rewrite what a grieving daughter was told.
        PassOnItem passedOn = letterTo(sarah, "What I wish I had told your father");
        passedOn.setReleaseWhen(PassOnRelease.AFTER);
        when(items.findByIdAndOwnerId(passedOn.getId(), margaret.getId())).thenReturn(Optional.of(passedOn));
        margaretHasBeenReleased();
        String body = """
                {"kind":"LETTER","title":"What I wish I had told your father",
                 "body":"Something else entirely.","audience":"PERSON","audienceUserId":"%s"}
                """.formatted(sarah.getId());

        mockMvc.perform(put("/api/passon/items/{id}", passedOn.getId())
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "This page has been passed on to the people it was written for. Nothing "
                                + "here can be added, changed or taken down now."));

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("a letter that has already been passed on cannot be taken away again")
    void aLetterAlreadyPassedOnCannotBeTakenDown() throws Exception {
        PassOnItem passedOn = letterTo(sarah, "What I wish I had told your father");
        passedOn.setReleaseWhen(PassOnRelease.AFTER);
        when(items.findByIdAndOwnerId(passedOn.getId(), margaret.getId())).thenReturn(Optional.of(passedOn));
        margaretHasBeenReleased();

        mockMvc.perform(delete("/api/passon/items/{id}", passedOn.getId())
                        .principal(margaretsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());

        verify(items, never()).delete(any());
    }

    @Test
    @DisplayName("a letter she meant for today cannot be turned into one held until after her death")
    void aReleasedOwnerCannotTurnALetterIntoAHeldOne() throws Exception {
        // The gate is already open, so an item flipped to AFTER now is readable the instant it
        // is saved — and frozen from that instant, so nobody could take it back down either.
        // Checking the timing on the stored row rather than on the owner missed exactly this.
        PassOnItem forToday = letterTo(sarah, "What I wish I had told your father");
        when(items.findByIdAndOwnerId(forToday.getId(), margaret.getId())).thenReturn(Optional.of(forToday));
        margaretHasBeenReleased();
        String body = """
                {"kind":"LETTER","title":"What I wish I had told your father",
                 "body":"Something else entirely.","audience":"PERSON",
                 "audienceUserId":"%s","releaseWhen":"AFTER"}
                """.formatted(sarah.getId());

        mockMvc.perform(put("/api/passon/items/{id}", forToday.getId())
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("nobody can write a new last letter in her name after she is gone")
    void aReleasedOwnerCannotWriteAnythingNew() throws Exception {
        // Without this, somebody holding her account can compose what reads as her final letter,
        // have it delivered at once, and leave it there permanently — the app itself could not
        // take it down again.
        margaretHasBeenReleased();
        String body = """
                {"kind":"LETTER","title":"One last thing","body":"Sign the house over.",
                 "audience":"PERSON","audienceUserId":"%s","releaseWhen":"AFTER"}
                """.formatted(sarah.getId());

        mockMvc.perform(post("/api/passon/items")
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "This page has been passed on to the people it was written for. Nothing "
                                + "here can be added, changed or taken down now."));

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("after she is gone even an ordinary story is closed to editing")
    void aReleasedOwnerCannotEvenEditAStory() throws Exception {
        // The rule is about the writing surface, not about held letters. A story she shared
        // years ago is still her voice, and after her death nobody gets to put words in it.
        PassOnItem story = story("The winter we lost the roof", PassOnAudience.EVERYONE);
        when(items.findByIdAndOwnerId(story.getId(), margaret.getId())).thenReturn(Optional.of(story));
        margaretHasBeenReleased();
        String body = """
                {"kind":"STORY","title":"The winter we lost the roof",
                 "body":"It never happened.","audience":"EVERYONE"}
                """;

        mockMvc.perform(put("/api/passon/items/{id}", story.getId())
                        .principal(margaretsSession)
                        .accept(MediaType.APPLICATION_JSON)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());

        verify(items, never()).save(any());
    }

    @Test
    @DisplayName("the freeze stops her writing, and never stops a letter being marked as read")
    void aHeldLetterIsStillStampedWhenItsPersonFinallyReadsIt() throws Exception {
        // Guard, not a bug fix. The first-read stamp is a save() on the read path, and it is the
        // one write that must survive the release — these are exactly the letters where "Sarah
        // read this on 3 June" matters. Anyone tempted to gate every write path for consistency
        // should fail this test.
        PassOnItem held = letterTo(sarah, "What I wish I had told your father");
        held.setReleaseWhen(PassOnRelease.AFTER);
        when(items.findByOwnerIdOrderByCreatedAtDesc(margaret.getId())).thenReturn(List.of(held));
        when(visibility.canRead(held, sarah.getId())).thenReturn(true);
        margaretHasBeenReleased();
        Authentication sarahsSession = new UsernamePasswordAuthenticationToken(sarah.getId().toString(), null);

        mockMvc.perform(get("/api/passon/from/{ownerId}", margaret.getId())
                        .principal(sarahsSession).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));

        assertThat(lastSaved().getFirstReadAt()).describedAs("the day it reached her").isNotNull();
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
