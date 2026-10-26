package com.towinly.reunion.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.ReunionGuestState;
import com.towinly.common.enums.ReunionOrganiserKind;
import com.towinly.common.enums.ReunionStep;
import com.towinly.common.enums.TrustLevel;
import com.towinly.common.enums.UserRole;
import com.towinly.common.exception.ForbiddenException;
import com.towinly.common.repository.UserRepository;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.emergency.service.SosService;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.notification.service.ExpoPushService;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.reunion.dto.OrganiserCandidateDto;
import com.towinly.reunion.dto.ReunionGuestRequest;
import com.towinly.reunion.dto.ReunionPlanRequest;
import com.towinly.reunion.dto.ReunionResponse;
import com.towinly.reunion.dto.ReunionWishRequest;
import com.towinly.reunion.entity.Reunion;
import com.towinly.reunion.entity.ReunionGuest;
import com.towinly.reunion.repository.ReunionGuestRepository;
import com.towinly.reunion.repository.ReunionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reunions: Margaret wants to see her B.Sc. batch again. Only a helper she
 * fully trusts, or her daughter, may organise; Margaret approves each step;
 * the reunion closes only when every guest who came is home; nobody asks a
 * guest for money.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReunionServiceTest {

    @Mock ReunionRepository reunionRepository;
    @Mock ReunionGuestRepository guestRepository;
    @Mock UserRepository userRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock SosService sosService;
    @Mock ExpoPushService expoPushService;

    ReunionService service;

    User margaret;   // the elder
    User priya;      // a helper Margaret fully trusts
    User raj;        // a helper only at VERIFIED
    User sarah;      // Margaret's daughter, active family link
    User stranger;
    Reunion reunion;

    @BeforeEach
    void setUp() {
        service = new ReunionService(reunionRepository, guestRepository, userRepository,
                connectionRepository, familyLinkRepository, elderProfileRepository,
                helperProfileRepository, sosService, expoPushService);

        margaret = user("margaret", "Margaret", UserRole.ELDER);
        priya = user("priya", "Priya", UserRole.HELPER);
        raj = user("raj", "Raj", UserRole.HELPER);
        sarah = user("sarah", "Sarah", UserRole.FAMILY);
        stranger = user("stranger", "Someone", UserRole.HELPER);

        for (User u : List.of(margaret, priya, raj, sarah, stranger)) {
            when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));
        }
        when(elderProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        when(helperProfileRepository.findByUserId(any())).thenReturn(Optional.empty());
        when(reunionRepository.save(any(Reunion.class))).thenAnswer(inv -> inv.getArgument(0));
        when(guestRepository.save(any(ReunionGuest.class))).thenAnswer(inv -> {
            ReunionGuest g = inv.getArgument(0);
            if (g.getId() == null) g.setId(UUID.randomUUID());
            return g;
        });

        Connection trusted = Connection.builder().id(UUID.randomUUID()).userA(margaret).userB(priya)
                .type(ConnectionType.SOCIAL).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.TRUSTED).build();
        Connection verifiedOnly = Connection.builder().id(UUID.randomUUID()).userA(margaret).userB(raj)
                .type(ConnectionType.SERVICE).status(ConnectionStatus.ACTIVE)
                .currentTrustLevel(TrustLevel.VERIFIED).build();
        when(connectionRepository.findByUserAndStatus(margaret.getId(), ConnectionStatus.ACTIVE))
                .thenReturn(List.of(trusted, verifiedOnly));

        FamilyLink link = new FamilyLink();
        link.setId(UUID.randomUUID());
        link.setElder(margaret);
        link.setFamilyUser(sarah);
        link.setStatus(FamilyLinkStatus.ACTIVE);
        when(familyLinkRepository.findByElderIdAndStatus(margaret.getId(), FamilyLinkStatus.ACTIVE))
                .thenReturn(List.of(link));

        reunion = Reunion.builder().id(UUID.randomUUID()).elder(margaret)
                .institution("B.Sc. batch, Presidency College").years("1968 to 1971").city("Madras")
                .step(ReunionStep.ORGANISER).build();
        when(reunionRepository.findById(reunion.getId())).thenReturn(Optional.of(reunion));
        when(guestRepository.findByReunionIdOrderByCreatedAtAsc(reunion.getId())).thenReturn(List.of());
    }

    // ---- the wish --------------------------------------------------------

    @Test
    void postWish_isTheEldersAndOpensOnWhoPlans() {
        ReunionWishRequest req = new ReunionWishRequest();
        req.setInstitution("B.Sc. batch, Presidency College");
        req.setYears("1968 to 1971");
        req.setCity("Madras");
        req.setNote("Kumar, Leela, the twins from the hostel");

        ReunionResponse out = service.postWish(margaret.getId(), req);

        assertThat(out.getStep()).isEqualTo(ReunionStep.ORGANISER);
        assertThat(out.getStepIndex()).isEqualTo(1);
        assertThat(out.getMyRole()).isEqualTo("ELDER");
        assertThat(out.getInstitution()).isEqualTo("B.Sc. batch, Presidency College");
    }

    @Test
    void postWish_refusesAHelperSeat() {
        ReunionWishRequest req = new ReunionWishRequest();
        req.setInstitution("Office batch");

        assertThatThrownBy(() -> service.postWish(priya.getId(), req))
                .isInstanceOf(ForbiddenException.class);
    }

    // ---- who may organise ---------------------------------------------------

    @Test
    void candidates_areFullyTrustedHelpersAndActiveFamilyOnly() {
        List<OrganiserCandidateDto> out = service.listOrganiserCandidates(margaret.getId(), reunion.getId());

        assertThat(out).extracting(OrganiserCandidateDto::getUserId)
                .containsExactlyInAnyOrder(priya.getId(), sarah.getId());
        assertThat(out).filteredOn(c -> c.getUserId().equals(priya.getId()))
                .extracting(OrganiserCandidateDto::getKind).containsExactly(ReunionOrganiserKind.HELPER);
        assertThat(out).filteredOn(c -> c.getUserId().equals(sarah.getId()))
                .extracting(OrganiserCandidateDto::getKind).containsExactly(ReunionOrganiserKind.FAMILY);
    }

    @Test
    void chooseOrganiser_refusesAStrangerAndAVerifiedOnlyHelper() {
        assertThatThrownBy(() -> service.chooseOrganiser(margaret.getId(), reunion.getId(), stranger.getId()))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.chooseOrganiser(margaret.getId(), reunion.getId(), raj.getId()))
                .isInstanceOf(ForbiddenException.class);
        assertThat(reunion.getOrganiser()).isNull();
    }

    @Test
    void chooseOrganiser_movesToFindingAndTellsTheOrganiser() {
        ReunionResponse out = service.chooseOrganiser(margaret.getId(), reunion.getId(), sarah.getId());

        assertThat(out.getStep()).isEqualTo(ReunionStep.FINDING);
        assertThat(out.getOrganiserId()).isEqualTo(sarah.getId());
        assertThat(out.getOrganiserKind()).isEqualTo(ReunionOrganiserKind.FAMILY);
        verify(expoPushService).sendToUser(eq(sarah.getId()), anyString(), anyString(), any());
    }

    @Test
    void chooseOrganiser_isTheEldersAlone() {
        assertThatThrownBy(() -> service.chooseOrganiser(sarah.getId(), reunion.getId(), sarah.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    // ---- finding ------------------------------------------------------------

    @Test
    void addGuest_startsRememberedAndRefusesAMoneyAsk() {
        organisedBy(priya, ReunionStep.FINDING);
        ReunionGuestRequest req = new ReunionGuestRequest();
        req.setName("Kumar");
        req.setNote("Walks with a stick. His son has the number.");

        ReunionResponse out = service.addGuest(priya.getId(), reunion.getId(), req);
        assertThat(out.getGuests()).hasSize(1);
        assertThat(out.getGuests().get(0).getState()).isEqualTo(ReunionGuestState.REMEMBERED);

        ReunionGuestRequest ask = new ReunionGuestRequest();
        ask.setName("Leela");
        ask.setNote("Please send money for the ticket to my bank account");
        assertThatThrownBy(() -> service.addGuest(priya.getId(), reunion.getId(), ask))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("money");
    }

    @Test
    void aStrangerCannotReadOrTouchAReunion() {
        organisedBy(priya, ReunionStep.FINDING);
        assertThatThrownBy(() -> service.getOne(stranger.getId(), reunion.getId()))
                .isInstanceOf(ForbiddenException.class);
        ReunionGuestRequest req = new ReunionGuestRequest();
        req.setName("Kumar");
        assertThatThrownBy(() -> service.addGuest(stranger.getId(), reunion.getId(), req))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void advanceFromFinding_needsAComingGuestAndTheElder() {
        organisedBy(priya, ReunionStep.FINDING);
        guests(guest("Kumar", ReunionGuestState.REACHED));

        assertThatThrownBy(() -> service.advance(margaret.getId(), reunion.getId()))
                .isInstanceOf(IllegalArgumentException.class);

        guests(guest("Kumar", ReunionGuestState.COMING));
        assertThatThrownBy(() -> service.advance(priya.getId(), reunion.getId()))
                .isInstanceOf(ForbiddenException.class);

        ReunionResponse out = service.advance(margaret.getId(), reunion.getId());
        assertThat(out.getStep()).isEqualTo(ReunionStep.PLAN);
    }

    // ---- the plan -----------------------------------------------------------

    @Test
    void advanceFromPlan_needsADayAndAPlaceThenTellsFamilyAndOrganiser() {
        organisedBy(priya, ReunionStep.PLAN);
        guests(guest("Kumar", ReunionGuestState.COMING));

        assertThatThrownBy(() -> service.advance(margaret.getId(), reunion.getId()))
                .isInstanceOf(IllegalArgumentException.class);
        verify(sosService, never()).notifyReunionPlanned(any(), any(), any());

        ReunionPlanRequest plan = new ReunionPlanRequest();
        plan.setPlannedOn("Sunday 14 December, 11 in the morning");
        plan.setVenue("Hotel Savera garden, Mylapore");
        plan.setRides("Priya drives Kumar; the rest come with family");
        service.setPlan(priya.getId(), reunion.getId(), plan);

        ReunionResponse out = service.advance(margaret.getId(), reunion.getId());

        assertThat(out.getStep()).isEqualTo(ReunionStep.DAY);
        verify(sosService).notifyReunionPlanned(margaret.getId(),
                "Sunday 14 December, 11 in the morning", "Hotel Savera garden, Mylapore");
        verify(expoPushService).sendToUser(eq(priya.getId()), anyString(), anyString(), any());
    }

    @Test
    void setPlan_refusesAMoneyAskInAnyField() {
        organisedBy(priya, ReunionStep.PLAN);
        ReunionPlanRequest plan = new ReunionPlanRequest();
        plan.setPlannedOn("Sunday");
        plan.setVenue("The park");
        plan.setBudget("Each guest should pay me by gift card");

        assertThatThrownBy(() -> service.setPlan(priya.getId(), reunion.getId(), plan))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---- the day and the send-off -------------------------------------------

    @Test
    void theDay_organiserChecksInOnlyComingGuestsAndMayEndTheDay() {
        organisedBy(priya, ReunionStep.DAY);
        ReunionGuest kumar = guest("Kumar", ReunionGuestState.COMING);
        ReunionGuest leela = guest("Leela", ReunionGuestState.CANNOT_COME);
        guests(kumar, leela);

        service.checkInGuest(priya.getId(), reunion.getId(), kumar.getId());
        assertThat(kumar.getArrivedAt()).isNotNull();
        assertThatThrownBy(() -> service.checkInGuest(priya.getId(), reunion.getId(), leela.getId()))
                .isInstanceOf(IllegalArgumentException.class);

        ReunionResponse out = service.advance(priya.getId(), reunion.getId());
        assertThat(out.getStep()).isEqualTo(ReunionStep.SEND_OFF);
    }

    @Test
    void close_needsEveryGuestWhoCameToBeHome() {
        organisedBy(priya, ReunionStep.SEND_OFF);
        ReunionGuest kumar = guest("Kumar", ReunionGuestState.COMING);
        kumar.setArrivedAt(LocalDateTime.now());
        ReunionGuest leela = guest("Leela", ReunionGuestState.COMING);
        leela.setArrivedAt(LocalDateTime.now());
        guests(kumar, leela);

        service.confirmGuestHome(priya.getId(), reunion.getId(), kumar.getId());
        assertThatThrownBy(() -> service.close(priya.getId(), reunion.getId(), "Thank you all"))
                .isInstanceOf(IllegalArgumentException.class);

        service.confirmGuestHome(priya.getId(), reunion.getId(), leela.getId());
        ReunionResponse out = service.close(priya.getId(), reunion.getId(), "Thank you all for coming");

        assertThat(out.getStep()).isEqualTo(ReunionStep.DONE);
        assertThat(out.getThankYou()).isEqualTo("Thank you all for coming");
        assertThat(out.getHomeCount()).isEqualTo(2);
        verify(expoPushService).sendToUser(eq(margaret.getId()), anyString(), anyString(), any());
    }

    // ---- stopping and stepping down -----------------------------------------

    @Test
    void stop_isTheEldersAtAnyStepBeforeDone() {
        organisedBy(priya, ReunionStep.PLAN);
        assertThatThrownBy(() -> service.stop(priya.getId(), reunion.getId()))
                .isInstanceOf(ForbiddenException.class);

        ReunionResponse out = service.stop(margaret.getId(), reunion.getId());
        assertThat(out.getStep()).isEqualTo(ReunionStep.STOPPED);
        assertThatThrownBy(() -> service.stop(margaret.getId(), reunion.getId()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void stepDown_returnsToWhoPlansAndKeepsTheGuests() {
        organisedBy(priya, ReunionStep.FINDING);
        guests(guest("Kumar", ReunionGuestState.FOUND));

        ReunionResponse out = service.stepDown(priya.getId(), reunion.getId());

        assertThat(out.getStep()).isEqualTo(ReunionStep.ORGANISER);
        assertThat(out.getOrganiserId()).isNull();
        assertThat(out.getGuests()).hasSize(1);
        verify(guestRepository, never()).delete(any());
    }

    @Test
    void stepDown_isNotAllowedOnceTheDayHasCome() {
        organisedBy(priya, ReunionStep.DAY);
        assertThatThrownBy(() -> service.stepDown(priya.getId(), reunion.getId()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void listMine_showsTheReunionToTheElderAndTheOrganiserWithCounts() {
        organisedBy(priya, ReunionStep.FINDING);
        ReunionGuest kumar = guest("Kumar", ReunionGuestState.COMING);
        ReunionGuest leela = guest("Leela", ReunionGuestState.FOUND);
        when(reunionRepository.findMine(priya.getId())).thenReturn(List.of(reunion));
        when(guestRepository.findByReunionIdInOrderByCreatedAtAsc(List.of(reunion.getId())))
                .thenReturn(List.of(kumar, leela));

        List<ReunionResponse> out = service.listMine(priya.getId());

        assertThat(out).hasSize(1);
        assertThat(out.get(0).getMyRole()).isEqualTo("ORGANISER");
        assertThat(out.get(0).getGuestCount()).isEqualTo(2);
        assertThat(out.get(0).getComingCount()).isEqualTo(1);
    }

    // ---- helpers ------------------------------------------------------------

    private static User user(String username, String fullName, UserRole role) {
        return User.builder().id(UUID.randomUUID()).username(username).fullName(fullName).role(role).build();
    }

    private void organisedBy(User organiser, ReunionStep step) {
        reunion.setOrganiser(organiser);
        reunion.setOrganiserKind(organiser.getRole() == UserRole.FAMILY
                ? ReunionOrganiserKind.FAMILY : ReunionOrganiserKind.HELPER);
        reunion.setStep(step);
    }

    private ReunionGuest guest(String name, ReunionGuestState state) {
        ReunionGuest g = ReunionGuest.builder().id(UUID.randomUUID()).reunion(reunion).name(name).state(state).build();
        when(guestRepository.findById(g.getId())).thenReturn(Optional.of(g));
        return g;
    }

    private void guests(ReunionGuest... list) {
        when(guestRepository.findByReunionIdOrderByCreatedAtAsc(reunion.getId())).thenReturn(List.of(list));
    }
}
