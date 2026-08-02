package com.towinly.common.seed;

import com.towinly.common.entity.User;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.SealedKind;
import com.towinly.common.enums.TrustLevel;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.TrustScoreService;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.emergency.repository.EmergencyContactRepository;
import com.towinly.family.repository.FamilyAlertRepository;
import com.towinly.family.repository.FamilyDelegatedPowerRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.messaging.repository.MessageRepository;
import com.towinly.need.entity.Need;
import com.towinly.need.repository.NeedApplicationRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.passon.dto.PassOnArmRequest;
import com.towinly.passon.dto.SealedItemRequest;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.service.KeyholderService;
import com.towinly.passon.service.SealedBoxService;
import com.towinly.passon.service.SealedCryptoService;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.report.repository.ReportRepository;
import com.towinly.review.repository.ReviewRepository;
import com.towinly.streak.repository.UserStreakRepository;
import com.towinly.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Task 15: the demo shows "What I pass on" working on day one — stories across all three
 * audiences, letters including one already read and one held until after she is gone, a
 * genuinely encrypted Sealed box, and three Keyholders with one question still unanswered.
 *
 * <p>Three of these tests are not about completeness at all.
 * {@link #holdsOneLetterForHerSisterAndNeverReleasesHer} and {@link #simulatesNoDeathAnywhere}
 * hold the line every review of this feature drew: the demo shows the <em>held</em> state and
 * never the released one, so no demo account sits in a state a job could advance and a public
 * demo can never regenerate "someone says you have died" every five minutes.
 * {@link #leavesTheSealedBoxAloneWhenThereIsNoMasterKey} holds the other one: locally and in CI
 * there is no master key, and a seeder that let {@code SealedBoxUnavailableException} escape a
 * {@code @Transactional} service would mark the whole seeding transaction rollback-only and take
 * the entire demo down with it.
 */
@ExtendWith(MockitoExtension.class)
class DemoDataSeederPassOnTest {

    private static final String MARGARET = DemoDataSeeder.ELDER_DEMO_EMAIL;
    private static final String SARAH = "demo.sarah@towin.app";
    /** Her sister, and the person the held letter is written to. */
    private static final String RUTH = "demo.ruth@towin.app";
    /** The elder David Chen — not Margaret's keyholder David, who is a FAMILY account. */
    private static final String DAVID_ELDER = "demo.david@towin.app";
    private static final String NINA = "demo.nina@towin.app";
    /** Every demo elder. Each owns a "My boxes" page, and none of it may open empty. */
    private static final List<String> ELDERS = List.of(MARGARET, DAVID_ELDER,
            "demo.grace@towin.app", "demo.rose@towin.app", "demo.helen@towin.app",
            "demo.arthur@towin.app", "demo.lakshmi@towin.app", "demo.meena@towin.app");

    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock MessageRepository messageRepository;
    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository needApplicationRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock UserStreakRepository userStreakRepository;
    @Mock EmergencyContactRepository emergencyContactRepository;
    @Mock ReportRepository reportRepository;
    @Mock TrustProgressionLogRepository trustProgressionLogRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock TrustScoreService trustScoreService;
    @Mock PlatformTransactionManager transactionManager;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyAlertRepository familyAlertRepository;
    @Mock FamilyDelegatedPowerRepository familyDelegatedPowerRepository;
    @Mock com.towinly.family.repository.FamilyPowerRequestRepository familyPowerRequestRepository;

    @Mock PassOnItemRepository passOnItemRepository;
    @Mock SealedItemRepository sealedItemRepository;
    @Mock KeyholderRepository keyholderRepository;
    @Mock PassOnSettingsRepository passOnSettingsRepository;
    @Mock PassOnOpenRepository passOnOpenRepository;
    @Mock SealedBoxService sealedBoxService;
    @Mock KeyholderService keyholderService;
    @Mock SealedCryptoService sealedCryptoService;

    @InjectMocks DemoDataSeeder seeder;

    @BeforeEach
    void stubHappyPath() {
        // Additive mode (no purge) unless a test flips it back on.
        ReflectionTestUtils.setField(seeder, "resetEnabled", false);

        lenient().when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        lenient().when(passwordEncoder.encode(anyString())).thenReturn("HASH");
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId(UUID.randomUUID());
            return u;
        });
        lenient().when(connectionRepository.save(any(Connection.class))).thenAnswer(inv -> {
            Connection c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        lenient().when(needRepository.save(any(Need.class))).thenAnswer(inv -> {
            Need n = inv.getArgument(0);
            if (n.getId() == null) n.setId(UUID.randomUUID());
            return n;
        });
        lenient().when(needRepository.findByElderIdOrderByCreatedAtDesc(any(), any()))
                .thenReturn(Page.empty());

        // The key is set, so the Sealed box seeds. One test turns this off on purpose.
        lenient().when(sealedCryptoService.isAvailable()).thenReturn(true);
        lenient().when(passOnItemRepository.findByOwnerIdAndKindOrderByCreatedAtDesc(any(), any()))
                .thenReturn(List.of());
        lenient().when(sealedItemRepository.countByOwnerId(any())).thenReturn(0L);
        lenient().when(passOnSettingsRepository.findById(any())).thenReturn(Optional.empty());
        // Arming really writes the INVITED rows; here it is mocked, so the rows the seeder
        // reads back to accept two of them are stubbed in their place.
        lenient().when(keyholderRepository.findByOwnerIdAndKeyholderId(any(), any()))
                .thenAnswer(inv -> Optional.of(Keyholder.builder()
                        .id(UUID.randomUUID())
                        .status(KeyholderStatus.INVITED)
                        .build()));
    }

    private User savedUser(String email) {
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository, atLeastOnce()).save(captor.capture());
        return captor.getAllValues().stream()
                .filter(u -> email.equals(u.getEmail()))
                .findFirst().orElse(null);
    }

    private List<PassOnItem> savedPassOnItems() {
        ArgumentCaptor<PassOnItem> captor = ArgumentCaptor.forClass(PassOnItem.class);
        verify(passOnItemRepository, atLeastOnce()).save(captor.capture());
        return captor.getAllValues();
    }

    private List<PassOnItem> savedOfKind(PassOnKind kind) {
        return savedPassOnItems().stream().filter(i -> i.getKind() == kind).toList();
    }

    private List<PassOnItem> savedOfKindFor(String ownerEmail, PassOnKind kind) {
        return savedOfKind(kind).stream()
                .filter(i -> ownerEmail.equals(i.getOwner().getEmail())).toList();
    }

    // ── the Story box ───────────────────────────────────────────────────

    @Test
    void seedsThreeStoriesOneForEachAudience() {
        seeder.run(null);

        verify(transactionManager, never()).rollback(any());
        List<PassOnItem> stories = savedOfKindFor(MARGARET, PassOnKind.STORY);
        assertThat(stories).as("three stories, so no audience filter opens on an empty list").hasSize(3);
        assertThat(stories).extracting(PassOnItem::getAudience)
                .as("Anyone, My family and My helpers are all exercised")
                .containsExactlyInAnyOrder(
                        PassOnAudience.EVERYONE, PassOnAudience.FAMILY, PassOnAudience.HELPERS);
        assertThat(stories).extracting(PassOnItem::getTitle)
                .contains("The winter we lost the roof",
                        "What I wish I had told your father",
                        "How to get the boiler going");
    }

    @Test
    void everyStoryIsReadableNowAndNamesNobody() {
        seeder.run(null);

        assertThat(savedOfKind(PassOnKind.STORY)).allSatisfy(s -> {
            assertThat(s.getReleaseWhen())
                    .as("a story is for people to read now — only a letter may be held back, "
                            + "and Postgres says the same in ck_passon_story")
                    .isEqualTo(PassOnRelease.NOW);
            assertThat(s.getAudienceUser())
                    .as("a story is written to a group, never to one person")
                    .isNull();
        });
    }

    // ── Letters ─────────────────────────────────────────────────────────

    @Test
    void seedsThreeLettersEachToOneNamedPerson() {
        seeder.run(null);

        List<PassOnItem> letters = savedOfKindFor(MARGARET, PassOnKind.LETTER);
        assertThat(letters).hasSize(3);
        assertThat(letters).allSatisfy(l -> {
            assertThat(l.getAudience()).isEqualTo(PassOnAudience.PERSON);
            assertThat(l.getAudienceUser()).as("a letter always has a reader").isNotNull();
        });
        assertThat(letters).extracting(PassOnItem::getReleaseWhen)
                .as("two she means to be read today, one she is holding back")
                .containsExactlyInAnyOrder(PassOnRelease.NOW, PassOnRelease.NOW, PassOnRelease.AFTER);
    }

    @Test
    void oneLetterHasAlreadyBeenReadAndTheOthersHaveNot() {
        seeder.run(null);

        List<PassOnItem> letters = savedOfKindFor(MARGARET, PassOnKind.LETTER);
        List<PassOnItem> read = letters.stream().filter(l -> l.getFirstReadAt() != null).toList();
        List<PassOnItem> unread = letters.stream().filter(l -> l.getFirstReadAt() == null).toList();

        assertThat(read).as("exercises the 'Sarah read this on 3 June' line").hasSize(1);
        assertThat(read.get(0).getAudienceUser().getEmail())
                .as("the read letter is the one the family demo login can open").isEqualTo(SARAH);
        assertThat(read.get(0).getFirstReadAt()).isBefore(LocalDateTime.now());
        assertThat(read.get(0).getReleaseWhen())
                .as("only a letter readable today can carry a read date")
                .isEqualTo(PassOnRelease.NOW);
        assertThat(unread)
                .as("one waiting to be read, and one that cannot be read at all yet").hasSize(2);
    }

    /**
     * The demo's answer to "what does <em>only after I'm gone</em> actually look like": one
     * letter written, addressed and held — while the woman who wrote it is plainly still here.
     *
     * <p>The two halves are one rule, not two. A held letter with no read date and no release is
     * the state a real elder who picks this lives in for years, and it is the only one the demo
     * may show: releasing her would freeze her whole page ({@code PassOnService.requireNotReleased})
     * and hand Ruth the letter — on a public demo that resets every five minutes and would
     * re-stage a death every time.
     */
    @Test
    void holdsOneLetterForHerSisterAndNeverReleasesHer() {
        PassOnSettings armed = PassOnSettings.builder().ownerId(UUID.randomUUID()).build();
        lenient().when(passOnSettingsRepository.findById(any()))
                .thenReturn(Optional.empty(), Optional.of(armed));

        seeder.run(null);

        List<PassOnItem> held = savedOfKind(PassOnKind.LETTER).stream()
                .filter(l -> l.getReleaseWhen() == PassOnRelease.AFTER)
                .toList();

        assertThat(held).as("exactly one letter is held back").hasSize(1);
        assertThat(held.get(0).getAudienceUser().getEmail())
                .as("addressed to one named person, like every letter").isEqualTo(RUTH);
        assertThat(held.get(0).getAudience()).isEqualTo(PassOnAudience.PERSON);
        assertThat(held.get(0).getBody()).as("warm and ordinary, not a legal notice").isNotBlank();
        assertThat(held.get(0).getFirstReadAt())
                .as("nobody can have read it: she has not been released").isNull();

        // The one switch that would open it. Every settings row the seeder writes leaves it null.
        ArgumentCaptor<PassOnSettings> captor = ArgumentCaptor.forClass(PassOnSettings.class);
        verify(passOnSettingsRepository, atLeastOnce()).save(captor.capture());
        assertThat(captor.getAllValues()).allSatisfy(row ->
                assertThat(row.getReleasedAt())
                        .as("no demo owner is ever released").isNull());
    }

    // ── every elder's boxes ─────────────────────────────────────────────

    @Test
    void everyDemoElderSeedsThreeStoriesOneForEachAudience() {
        seeder.run(null);

        for (String elder : ELDERS) {
            List<PassOnItem> stories = savedOfKindFor(elder, PassOnKind.STORY);
            assertThat(stories)
                    .as("%s: three stories, so no audience filter opens on an empty list", elder)
                    .hasSize(3);
            assertThat(stories).extracting(PassOnItem::getAudience)
                    .containsExactlyInAnyOrder(
                            PassOnAudience.EVERYONE, PassOnAudience.FAMILY, PassOnAudience.HELPERS);
        }
    }

    @Test
    void everyDemoElderSeedsAtLeastOneLetterToANamedPerson() {
        seeder.run(null);

        for (String elder : ELDERS) {
            List<PassOnItem> letters = savedOfKindFor(elder, PassOnKind.LETTER);
            assertThat(letters).as("%s: the Letter box never opens empty", elder).isNotEmpty();
            assertThat(letters).allSatisfy(l -> {
                assertThat(l.getAudience()).isEqualTo(PassOnAudience.PERSON);
                assertThat(l.getAudienceUser()).as("a letter always has a reader").isNotNull();
            });
        }
    }

    @Test
    void davidsLetterIsReadAndEveryOtherNewLetterIsWaiting() {
        seeder.run(null);

        List<PassOnItem> others = savedOfKind(PassOnKind.LETTER).stream()
                .filter(l -> !MARGARET.equals(l.getOwner().getEmail())).toList();
        List<PassOnItem> read = others.stream().filter(l -> l.getFirstReadAt() != null).toList();

        assertThat(read)
                .as("outside Margaret's box exactly one letter shows the 'read on' line")
                .hasSize(1);
        assertThat(read.get(0).getOwner().getEmail()).isEqualTo(DAVID_ELDER);
        assertThat(read.get(0).getAudienceUser().getEmail()).isEqualTo(NINA);
        assertThat(read.get(0).getFirstReadAt()).isBefore(LocalDateTime.now());
    }

    /**
     * The letter form only offers ACTIVE family links and TRUSTED helpers
     * ({@code peopleSheKnows} in PassOn.jsx), so a seeded letter to anyone else would put the
     * elder in a state she could never have reached herself — an addressee her own edit form
     * could not re-select.
     */
    @Test
    void everyNewLetterNamesAHelperTheElderHoldsAtTrusted() {
        seeder.run(null);

        ArgumentCaptor<Connection> captor = ArgumentCaptor.forClass(Connection.class);
        verify(connectionRepository, atLeastOnce()).save(captor.capture());
        Set<String> trusted = new HashSet<>();
        for (Connection c : captor.getAllValues()) {
            if (c.getStatus() == ConnectionStatus.ACTIVE
                    && c.getCurrentTrustLevel() == TrustLevel.TRUSTED) {
                trusted.add(c.getUserA().getEmail() + "->" + c.getUserB().getEmail());
                trusted.add(c.getUserB().getEmail() + "->" + c.getUserA().getEmail());
            }
        }

        savedOfKind(PassOnKind.LETTER).stream()
                .filter(l -> !MARGARET.equals(l.getOwner().getEmail()))
                .forEach(l -> assertThat(trusted)
                        .as("%s writes to %s, someone the letter form could actually offer",
                                l.getOwner().getEmail(), l.getAudienceUser().getEmail())
                        .contains(l.getOwner().getEmail() + "->" + l.getAudienceUser().getEmail()));
    }

    // ── the Sealed box ──────────────────────────────────────────────────

    @Test
    void sealsThreeItemsThroughTheRealSealedBoxService() {
        seeder.run(null);

        ArgumentCaptor<SealedItemRequest> captor = ArgumentCaptor.forClass(SealedItemRequest.class);
        verify(sealedBoxService, times(3)).add(any(), captor.capture());
        List<SealedItemRequest> sealed = captor.getAllValues();

        assertThat(sealed).as("every item is encrypted by the service the product uses").hasSize(3);
        assertThat(sealed).allSatisfy(r -> {
            assertThat(r.getLabel()).isNotBlank();
            assertThat(r.getBody()).isNotBlank();
            assertThat(r.getKindHint()).isNotNull();
        });
        assertThat(sealed).extracting(SealedItemRequest::getKindHint)
                .as("no demo item teaches an elder to write a password down")
                .doesNotContain(SealedKind.PASSWORDS);
    }

    @Test
    void leavesTheSealedBoxAloneWhenThereIsNoMasterKey() {
        lenient().when(sealedCryptoService.isAvailable()).thenReturn(false);

        seeder.run(null);

        verify(transactionManager, never()).rollback(any());
        verify(sealedBoxService, never()).add(any(), any());
        verify(sealedBoxService, never()).arm(any(), any());
        assertThat(savedOfKind(PassOnKind.STORY))
                .as("the writing still seeds — only the encrypted half is skipped")
                .hasSize(3 * ELDERS.size());
    }

    // ── Keyholders and the settled state ────────────────────────────────

    @Test
    void asksThreePeopleAndNeedsTwoOfThemToAgree() {
        seeder.run(null);

        ArgumentCaptor<PassOnArmRequest> captor = ArgumentCaptor.forClass(PassOnArmRequest.class);
        verify(sealedBoxService).arm(any(), captor.capture());
        PassOnArmRequest armed = captor.getValue();

        assertThat(armed.getPersonIds()).as("three Keyholders").hasSize(3);
        assertThat(armed.getApprovalsNeeded())
                .as("two of the three — never one, never all of them").isEqualTo(2);
        assertThat(armed.getNotAWillAck()).isEqualTo(SealedBoxService.NOT_A_WILL_ACK);
        assertThat(armed.getKeyTruthAck()).isEqualTo(SealedBoxService.KEY_TRUTH_ACK);
    }

    @Test
    void twoOfThemHaveSaidYesAndOneHasNotAnsweredYet() {
        seeder.run(null);

        // Only the two who accept are answered for. The third row is left INVITED, so the
        // elder's screen shows a real "asked, not answered yet" and the person it was asked
        // of opens on a real acceptance card.
        verify(keyholderService, times(2)).respond(any(), any(), eq(true));
        verify(keyholderService, never()).respond(any(), any(), eq(false));
    }

    @Test
    void opensOnTheSettledStateRatherThanTheSevenDayBanner() {
        PassOnSettings armed = PassOnSettings.builder().ownerId(UUID.randomUUID()).build();
        lenient().when(passOnSettingsRepository.findById(any()))
                .thenReturn(Optional.empty(), Optional.of(armed));

        seeder.run(null);

        ArgumentCaptor<PassOnSettings> captor = ArgumentCaptor.forClass(PassOnSettings.class);
        verify(passOnSettingsRepository, atLeastOnce()).save(captor.capture());
        PassOnSettings settled = captor.getValue();

        assertThat(settled.getArmedAt()).as("set up a while ago").isBefore(LocalDateTime.now());
        assertThat(settled.getCoolingOffUntil())
                .as("her seven days are over, so the demo opens settled")
                .isBefore(LocalDateTime.now());
    }

    // ── the line every review of this feature drew ──────────────────────

    @Test
    void simulatesNoDeathAnywhere() {
        seeder.run(null);

        // The seeder writes no record rows of its own at all, which is what makes a fabricated
        // release structurally impossible rather than merely absent today: every row in the
        // Sealed box record comes from a real action taken through the real service.
        verify(passOnOpenRepository, never()).save(any());
    }

    // ── the visitor's writes are undone ─────────────────────────────────

    @Test
    void resetClearsEverythingAVisitorPassedOn() {
        ReflectionTestUtils.setField(seeder, "resetEnabled", true);
        lenient().when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        seeder.run(null);

        verify(transactionManager, never()).rollback(any());
        // By owner, not by kind or by timing — so the letter she holds until after she is gone
        // is undone by the same call as everything else she wrote, and a visitor who writes
        // their own held letter on the demo account leaves nothing behind either.
        verify(passOnItemRepository, atLeastOnce()).deleteByOwnerId(any());
        verify(sealedItemRepository, atLeastOnce()).deleteByOwnerId(any());
        verify(passOnSettingsRepository, atLeastOnce()).deleteByOwnerId(any());
        verify(passOnOpenRepository, atLeastOnce()).deleteByOwnerId(any());
        verify(keyholderRepository, atLeastOnce()).deleteByOwnerIdOrKeyholderId(any(), any());
    }

    // ── the two family members the Keyholders are drawn from ────────────

    @Test
    void seedsTheTwoFamilyMembersTheThirdAndFourthKeysBelongTo() {
        seeder.run(null);

        assertThat(savedUser("demo.davidson@towin.app"))
                .as("Keyholders come from the family list and nowhere else").isNotNull()
                .satisfies(u -> assertThat(u.getRole()).isEqualTo(UserRole.FAMILY));
        assertThat(savedUser("demo.ruth@towin.app")).isNotNull()
                .satisfies(u -> assertThat(u.getRole()).isEqualTo(UserRole.FAMILY));
        assertThat(DemoDataSeeder.DEMO_EMAILS)
                .as("the reset coordinator and the email guard both read this list")
                .contains("demo.davidson@towin.app", "demo.ruth@towin.app");
    }
}
