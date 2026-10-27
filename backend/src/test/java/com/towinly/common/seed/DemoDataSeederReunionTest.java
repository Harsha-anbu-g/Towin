package com.towinly.common.seed;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ReunionGuestState;
import com.towinly.common.enums.ReunionOrganiserKind;
import com.towinly.common.enums.ReunionStep;
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
import com.towinly.reunion.entity.Reunion;
import com.towinly.reunion.entity.ReunionGuest;
import com.towinly.reunion.repository.ReunionGuestRepository;
import com.towinly.reunion.repository.ReunionRepository;
import com.towinly.reunion.service.ReunionText;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * The demo shows a Reunion on every public login from day one (owner call
 * 2026-10-26: "in a demo account, please keep a demo for this also"). Margaret,
 * the elder demo, has one at "The plan" with the approve button live; her
 * daughter Sarah, the family demo, organises it. Harsha, the helper demo,
 * organises Grace's, already on "The day", with a guest still to check in, so
 * each login has a step it can walk itself before the reset puts it back.
 */
@ExtendWith(MockitoExtension.class)
class DemoDataSeederReunionTest {

    private static final String MARGARET = DemoDataSeeder.ELDER_DEMO_EMAIL;
    private static final String HARSHA = DemoDataSeeder.HELPER_DEMO_EMAIL;
    private static final String SARAH = "demo.sarah@towin.app";
    private static final String GRACE = "demo.grace@towin.app";

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
    @Mock ReunionRepository reunionRepository;
    @Mock ReunionGuestRepository reunionGuestRepository;
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
        // No master key here, as on every local machine: the Sealed box half is skipped.
        lenient().when(sealedCryptoService.isAvailable()).thenReturn(false);
        lenient().when(reunionRepository.save(any(Reunion.class))).thenAnswer(inv -> {
            Reunion r = inv.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
    }

    private List<Reunion> savedReunions() {
        ArgumentCaptor<Reunion> captor = ArgumentCaptor.forClass(Reunion.class);
        verify(reunionRepository, atLeastOnce()).save(captor.capture());
        return captor.getAllValues();
    }

    private Reunion reunionOf(String elderEmail) {
        return savedReunions().stream()
                .filter(r -> elderEmail.equals(r.getElder().getEmail()))
                .findFirst().orElseThrow();
    }

    private List<ReunionGuest> guestsOf(Reunion reunion) {
        ArgumentCaptor<ReunionGuest> captor = ArgumentCaptor.forClass(ReunionGuest.class);
        verify(reunionGuestRepository, atLeastOnce()).save(captor.capture());
        return captor.getAllValues().stream()
                .filter(g -> g.getReunion().getId().equals(reunion.getId())).toList();
    }

    @Test
    void seedsOneReunionForEachPublicLogin() {
        seeder.run(null);

        verify(transactionManager, never()).rollback(any());
        assertThat(savedReunions()).as("two reunions: one per organiser kind, one per step").hasSize(2);

        Reunion margarets = reunionOf(MARGARET);
        assertThat(margarets.getOrganiser().getEmail()).isEqualTo(SARAH);
        assertThat(margarets.getOrganiserKind()).isEqualTo(ReunionOrganiserKind.FAMILY);
        assertThat(margarets.getStep()).isEqualTo(ReunionStep.PLAN);

        Reunion graces = reunionOf(GRACE);
        assertThat(graces.getOrganiser().getEmail()).isEqualTo(HARSHA);
        assertThat(graces.getOrganiserKind()).isEqualTo(ReunionOrganiserKind.HELPER);
        assertThat(graces.getStep()).isEqualTo(ReunionStep.DAY);
    }

    @Test
    void margaretsPlanIsReadyForHerToApprove() {
        seeder.run(null);

        Reunion margarets = reunionOf(MARGARET);
        assertThat(margarets.getPlannedOn()).as("the approve button needs a day").startsWith("Sunday");
        assertThat(margarets.getVenue()).as("and a place").isNotBlank();

        List<ReunionGuest> guests = guestsOf(margarets);
        assertThat(guests).extracting(ReunionGuest::getState)
                .as("the step before needed somebody Coming, and the list shows every state")
                .contains(ReunionGuestState.COMING, ReunionGuestState.REACHED,
                        ReunionGuestState.CANNOT_COME, ReunionGuestState.REMEMBERED);
        assertThat(guests).allSatisfy(g -> {
            assertThat(g.getArrivedAt()).as("nobody has arrived before the day").isNull();
            assertThat(g.getHomeAt()).isNull();
        });
    }

    @Test
    void gracesDayIsUnderWayWithOneGuestStillToCheckIn() {
        seeder.run(null);

        List<ReunionGuest> guests = guestsOf(reunionOf(GRACE));
        assertThat(guests).extracting(ReunionGuest::getState)
                .as("only Coming guests can be checked in")
                .containsOnly(ReunionGuestState.COMING);
        assertThat(guests).filteredOn(g -> g.getArrivedAt() != null)
                .as("two already checked in, so the list is not blank").hasSize(2);
        assertThat(guests).filteredOn(g -> g.getArrivedAt() == null)
                .as("one left for the helper to check in").hasSize(1);
        assertThat(guests).allSatisfy(g ->
                assertThat(g.getHomeAt()).as("the send-off has not started").isNull());
    }

    @Test
    void theDemoCopyPassesTheFeaturesOwnMoneyRule() {
        seeder.run(null);

        for (Reunion r : savedReunions()) {
            assertThatCode(() -> ReunionText.rejectMoneyAsk(
                    r.getNote(), r.getRides(), r.getFood(), r.getBudget(), r.getThankYou()))
                    .as("no seeded sentence may read as a money ask").doesNotThrowAnyException();
            Stream<String> notes = guestsOf(r).stream().map(ReunionGuest::getNote);
            assertThatCode(() -> ReunionText.rejectMoneyAsk(notes.toArray(String[]::new)))
                    .doesNotThrowAnyException();
        }
    }

    @Test
    void doesNotSeedAReunionTheElderAlreadyHas() {
        Reunion existing = Reunion.builder().id(UUID.randomUUID())
                .institution("Teachers' college, class of 1976").build();
        lenient().when(reunionRepository.findMine(any())).thenReturn(List.of(existing));

        seeder.run(null);

        assertThat(savedReunions()).extracting(Reunion::getInstitution)
                .as("Margaret's is already there; only Grace's is new")
                .containsExactly("Pharmacy school, class of 1979");
    }
}
