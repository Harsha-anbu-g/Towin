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
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.emergency.service.SosService;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.notification.service.ExpoPushService;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.reunion.dto.OrganiserCandidateDto;
import com.towinly.reunion.dto.ReunionGuestDto;
import com.towinly.reunion.dto.ReunionGuestRequest;
import com.towinly.reunion.dto.ReunionPlanRequest;
import com.towinly.reunion.dto.ReunionResponse;
import com.towinly.reunion.dto.ReunionWishRequest;
import com.towinly.reunion.entity.Reunion;
import com.towinly.reunion.entity.ReunionGuest;
import com.towinly.reunion.repository.ReunionGuestRepository;
import com.towinly.reunion.repository.ReunionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Reunions: an elder meets old classmates or colleagues again. Every rule lives
 * here. Who may organise (a fully trusted helper or an active family member,
 * chosen by the elder for this one reunion), what each of the seven steps needs
 * before it moves on, who may move it, and that no reunion closes until every
 * guest who came is home. The controller is a thin door onto these methods.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReunionService {

    public static final String ROLE_ELDER = "ELDER";
    public static final String ROLE_ORGANISER = "ORGANISER";

    private static final String NOT_A_PARTY = "Only the elder and the organiser can see this reunion.";
    private static final String ELDER_ONLY = "Only the elder can do this on a reunion.";
    private static final String ORGANISER_ONLY = "Only the organiser can do this on a reunion.";
    private static final String ELDER_APPROVES = "The elder approves this step.";
    private static final String WRONG_STEP = "This reunion is not at the step that needs.";

    private final ReunionRepository reunionRepository;
    private final ReunionGuestRepository guestRepository;
    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;
    private final FamilyLinkRepository familyLinkRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final SosService sosService;
    private final ExpoPushService expoPushService;

    // ---- reading ---------------------------------------------------------------

    /** Every reunion the caller is part of, as the elder or the organiser, newest first. */
    @Transactional(readOnly = true)
    public List<ReunionResponse> listMine(UUID callerId) {
        List<Reunion> mine = reunionRepository.findMine(callerId);
        if (mine.isEmpty()) return List.of();
        List<UUID> ids = mine.stream().map(Reunion::getId).toList();
        Map<UUID, List<ReunionGuest>> guests = guestRepository.findByReunionIdInOrderByCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(g -> g.getReunion().getId(), LinkedHashMap::new, Collectors.toList()));
        return mine.stream()
                .map(r -> toResponse(r, guests.getOrDefault(r.getId(), List.of()), callerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public ReunionResponse getOne(UUID callerId, UUID reunionId) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        return toResponse(r, guestsOf(r), callerId);
    }

    // ---- step 1, the wish ---------------------------------------------------------

    /** The elder writes the wish. The reunion opens straight on "Who plans". */
    @Transactional
    public ReunionResponse postWish(UUID callerId, ReunionWishRequest req) {
        User elder = getUser(callerId);
        if (elder.getRole() != UserRole.ELDER && elder.getRole() != UserRole.BOTH) {
            throw new ForbiddenException("Only an elder can wish for a reunion.");
        }
        ReunionText.rejectMoneyAsk(req.getNote());
        Reunion r = reunionRepository.save(Reunion.builder()
                .elder(elder)
                .institution(req.getInstitution().trim())
                .years(blankToNull(req.getYears()))
                .city(blankToNull(req.getCity()))
                .note(blankToNull(req.getNote()))
                .step(ReunionStep.ORGANISER)
                .build());
        return toResponse(r, List.of(), callerId);
    }

    // ---- step 2, who plans -------------------------------------------------------

    /**
     * The people the elder may choose: helpers whose elder-helper connection
     * stands at the top of the ladder (TRUSTED), and family members with an
     * active link. Nobody else, and nobody can volunteer.
     */
    @Transactional(readOnly = true)
    public List<OrganiserCandidateDto> listOrganiserCandidates(UUID callerId, UUID reunionId) {
        Reunion r = load(reunionId);
        assertElder(r, callerId, ELDER_ONLY);
        return candidatesFor(r.getElder());
    }

    @Transactional
    public ReunionResponse chooseOrganiser(UUID callerId, UUID reunionId, UUID organiserId) {
        Reunion r = load(reunionId);
        assertElder(r, callerId, ELDER_ONLY);
        assertStepIn(r, ReunionStep.ORGANISER);
        OrganiserCandidateDto pick = candidatesFor(r.getElder()).stream()
                .filter(c -> c.getUserId().equals(organiserId))
                .findFirst()
                .orElseThrow(() -> new ForbiddenException(
                        "Only a helper you fully trust or a family member can plan a reunion."));
        r.setOrganiser(getUser(organiserId));
        r.setOrganiserKind(pick.getKind());
        r.setStep(ReunionStep.FINDING);
        reunionRepository.save(r);
        push(r.getOrganiser(), "You were asked to plan a reunion",
                nameOf(r.getElder()) + " chose you to plan their reunion: " + r.getInstitution() + ".", r);
        return toResponse(r, guestsOf(r), callerId);
    }

    // ---- step 3, finding -----------------------------------------------------------

    @Transactional
    public ReunionResponse addGuest(UUID callerId, UUID reunionId, ReunionGuestRequest req) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        assertStepIn(r, ReunionStep.FINDING, ReunionStep.PLAN);
        ReunionText.rejectMoneyAsk(req.getNote());
        // Read the list before the save: the new row is appended by hand, so
        // the answer is the same whether or not the flush happened yet.
        List<ReunionGuest> guests = new ArrayList<>(guestsOf(r));
        guests.add(guestRepository.save(ReunionGuest.builder()
                .reunion(r)
                .name(req.getName().trim())
                .phone(blankToNull(req.getPhone()))
                .note(blankToNull(req.getNote()))
                .state(ReunionGuestState.REMEMBERED)
                .build()));
        return toResponse(r, guests, callerId);
    }

    @Transactional
    public ReunionResponse setGuestState(UUID callerId, UUID reunionId, UUID guestId, ReunionGuestState state) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        assertStepIn(r, ReunionStep.FINDING, ReunionStep.PLAN);
        ReunionGuest g = loadGuest(r, guestId);
        g.setState(state);
        guestRepository.save(g);
        return toResponse(r, guestsOf(r), callerId);
    }

    @Transactional
    public ReunionResponse removeGuest(UUID callerId, UUID reunionId, UUID guestId) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        assertStepIn(r, ReunionStep.FINDING, ReunionStep.PLAN);
        ReunionGuest g = loadGuest(r, guestId);
        guestRepository.delete(g);
        List<ReunionGuest> left = guestsOf(r).stream().filter(x -> !x.getId().equals(guestId)).toList();
        return toResponse(r, left, callerId);
    }

    // ---- step 4, the plan ----------------------------------------------------------

    @Transactional
    public ReunionResponse setPlan(UUID callerId, UUID reunionId, ReunionPlanRequest req) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        assertStepIn(r, ReunionStep.FINDING, ReunionStep.PLAN);
        ReunionText.rejectMoneyAsk(req.getRides(), req.getFood(), req.getBudget(), req.getVenue(), req.getPlannedOn());
        r.setPlannedOn(blankToNull(req.getPlannedOn()));
        r.setVenue(blankToNull(req.getVenue()));
        r.setRides(blankToNull(req.getRides()));
        r.setFood(blankToNull(req.getFood()));
        r.setBudget(blankToNull(req.getBudget()));
        reunionRepository.save(r);
        return toResponse(r, guestsOf(r), callerId);
    }

    // ---- moving on -----------------------------------------------------------------

    /**
     * One step forward. Finding to the plan and the plan to the day are the
     * elder's taps alone, each with its condition; the day to the send-off is
     * either side's. Closing is {@link #close}, choosing is {@link #chooseOrganiser}.
     */
    @Transactional
    public ReunionResponse advance(UUID callerId, UUID reunionId) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        List<ReunionGuest> guests = guestsOf(r);
        switch (r.getStep()) {
            case FINDING -> {
                assertElder(r, callerId, ELDER_APPROVES);
                if (guests.stream().noneMatch(g -> g.getState() == ReunionGuestState.COMING)) {
                    throw new IllegalArgumentException("At least one guest needs to be coming before the plan.");
                }
                r.setStep(ReunionStep.PLAN);
            }
            case PLAN -> {
                assertElder(r, callerId, ELDER_APPROVES);
                if (isBlank(r.getPlannedOn()) || isBlank(r.getVenue())) {
                    throw new IllegalArgumentException("The plan needs a day and a place first.");
                }
                r.setStep(ReunionStep.DAY);
                sosService.notifyReunionPlanned(r.getElder().getId(), r.getPlannedOn(), r.getVenue());
                push(r.getOrganiser(), "The plan is approved",
                        nameOf(r.getElder()) + " approved the reunion plan for " + r.getPlannedOn() + ".", r);
            }
            case DAY -> r.setStep(ReunionStep.SEND_OFF);
            default -> throw new IllegalArgumentException("This reunion cannot move on from here.");
        }
        reunionRepository.save(r);
        return toResponse(r, guests, callerId);
    }

    // ---- step 5, the day -------------------------------------------------------------

    @Transactional
    public ReunionResponse checkInGuest(UUID callerId, UUID reunionId, UUID guestId) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        assertStepIn(r, ReunionStep.DAY);
        ReunionGuest g = loadGuest(r, guestId);
        if (g.getState() != ReunionGuestState.COMING) {
            throw new IllegalArgumentException("Only a guest who said they are coming can be checked in.");
        }
        if (g.getArrivedAt() == null) {
            g.setArrivedAt(LocalDateTime.now());
            guestRepository.save(g);
        }
        return toResponse(r, guestsOf(r), callerId);
    }

    // ---- step 6, the send-off ----------------------------------------------------------

    @Transactional
    public ReunionResponse confirmGuestHome(UUID callerId, UUID reunionId, UUID guestId) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        assertStepIn(r, ReunionStep.DAY, ReunionStep.SEND_OFF);
        ReunionGuest g = loadGuest(r, guestId);
        if (g.getArrivedAt() == null) {
            throw new IllegalArgumentException("This guest was not checked in on the day.");
        }
        if (g.getHomeAt() == null) {
            g.setHomeAt(LocalDateTime.now());
            guestRepository.save(g);
        }
        return toResponse(r, guestsOf(r), callerId);
    }

    /** The send-off is done: every guest who came is home. Towinly's name is on this. */
    @Transactional
    public ReunionResponse close(UUID callerId, UUID reunionId, String thankYou) {
        Reunion r = load(reunionId);
        assertParty(r, callerId);
        assertStepIn(r, ReunionStep.SEND_OFF);
        List<ReunionGuest> guests = guestsOf(r);
        boolean someoneStillOut = guests.stream()
                .anyMatch(g -> g.getArrivedAt() != null && g.getHomeAt() == null);
        if (someoneStillOut) {
            throw new IllegalArgumentException("Every guest who came needs to be home first.");
        }
        ReunionText.rejectMoneyAsk(thankYou);
        r.setThankYou(blankToNull(thankYou));
        r.setStep(ReunionStep.DONE);
        r.setClosedAt(LocalDateTime.now());
        reunionRepository.save(r);
        User other = callerId.equals(r.getElder().getId()) ? r.getOrganiser() : r.getElder();
        push(other, "Everyone is home", "The reunion is over and every guest who came is home. Thank you.", r);
        return toResponse(r, guests, callerId);
    }

    // ---- stopping and stepping down ------------------------------------------------------

    /** The elder stops the reunion at any step before it is done. Nothing else is deleted. */
    @Transactional
    public ReunionResponse stop(UUID callerId, UUID reunionId) {
        Reunion r = load(reunionId);
        assertElder(r, callerId, ELDER_ONLY);
        if (r.getStep().isOver()) {
            throw new IllegalArgumentException("This reunion is already over.");
        }
        r.setStep(ReunionStep.STOPPED);
        r.setClosedAt(LocalDateTime.now());
        reunionRepository.save(r);
        push(r.getOrganiser(), "A reunion was stopped",
                nameOf(r.getElder()) + " stopped the reunion: " + r.getInstitution() + ".", r);
        return toResponse(r, guestsOf(r), callerId);
    }

    /** The organiser leaves before the day. The reunion returns to "Who plans" and keeps its guests. */
    @Transactional
    public ReunionResponse stepDown(UUID callerId, UUID reunionId) {
        Reunion r = load(reunionId);
        assertOrganiser(r, callerId);
        if (r.getStep() != ReunionStep.FINDING && r.getStep() != ReunionStep.PLAN) {
            throw new IllegalArgumentException("An organiser can only step down before the day.");
        }
        User leaving = r.getOrganiser();
        r.setOrganiser(null);
        r.setOrganiserKind(null);
        r.setStep(ReunionStep.ORGANISER);
        reunionRepository.save(r);
        push(r.getElder(), "Your organiser stepped down",
                nameOf(leaving) + " can no longer plan the reunion. Please choose someone else.", r);
        return toResponse(r, guestsOf(r), callerId);
    }

    // ---- helpers ---------------------------------------------------------------------------

    private List<OrganiserCandidateDto> candidatesFor(User elder) {
        List<OrganiserCandidateDto> out = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Connection c : connectionRepository.findByUserAndStatus(elder.getId(), ConnectionStatus.ACTIVE)) {
            if (!ConnectionType.earnsTrust(c.getType())) continue;
            if (c.getCurrentTrustLevel() != TrustLevel.TRUSTED) continue;
            User other = c.getOtherUser(elder.getId());
            if (other == null || other.getId().equals(elder.getId())) continue;
            if (other.getRole() != UserRole.HELPER && other.getRole() != UserRole.BOTH) continue;
            if (!seen.add(other.getId())) continue;
            out.add(OrganiserCandidateDto.builder()
                    .userId(other.getId()).name(nameOf(other)).photoUrl(other.getPhotoUrl())
                    .kind(ReunionOrganiserKind.HELPER).connectionId(c.getId())
                    .build());
        }
        for (FamilyLink l : familyLinkRepository.findByElderIdAndStatus(elder.getId(), FamilyLinkStatus.ACTIVE)) {
            User fam = l.getFamilyUser();
            if (fam == null || !seen.add(fam.getId())) continue;
            out.add(OrganiserCandidateDto.builder()
                    .userId(fam.getId()).name(nameOf(fam)).photoUrl(fam.getPhotoUrl())
                    .kind(ReunionOrganiserKind.FAMILY).relationship(l.getRelationship())
                    .build());
        }
        return out;
    }

    private ReunionResponse toResponse(Reunion r, List<ReunionGuest> guests, UUID callerId) {
        boolean elder = callerId.equals(r.getElder().getId());
        int found = 0, reached = 0, coming = 0, cannot = 0, arrived = 0, home = 0;
        for (ReunionGuest g : guests) {
            switch (g.getState()) {
                case FOUND -> found++;
                case REACHED -> reached++;
                case COMING -> coming++;
                case CANNOT_COME -> cannot++;
                default -> { }
            }
            if (g.getArrivedAt() != null) arrived++;
            if (g.getHomeAt() != null) home++;
        }
        return ReunionResponse.builder()
                .id(r.getId())
                .elderId(r.getElder().getId())
                .elderName(nameOf(r.getElder()))
                .organiserId(r.getOrganiser() == null ? null : r.getOrganiser().getId())
                .organiserName(r.getOrganiser() == null ? null : nameOf(r.getOrganiser()))
                .organiserKind(r.getOrganiserKind())
                .institution(r.getInstitution())
                .years(r.getYears())
                .city(r.getCity())
                .note(r.getNote())
                .plannedOn(r.getPlannedOn())
                .venue(r.getVenue())
                .rides(r.getRides())
                .food(r.getFood())
                .budget(r.getBudget())
                .thankYou(r.getThankYou())
                .step(r.getStep())
                .stepIndex(r.getStep().index())
                .myRole(elder ? ROLE_ELDER : ROLE_ORGANISER)
                .guestCount(guests.size())
                .foundCount(found)
                .reachedCount(reached)
                .comingCount(coming)
                .cannotComeCount(cannot)
                .arrivedCount(arrived)
                .homeCount(home)
                .guests(guests.stream().map(g -> ReunionGuestDto.builder()
                        .id(g.getId()).name(g.getName()).phone(g.getPhone()).note(g.getNote())
                        .state(g.getState()).arrivedAt(g.getArrivedAt()).homeAt(g.getHomeAt())
                        .build()).toList())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .closedAt(r.getClosedAt())
                .build();
    }

    private Reunion load(UUID reunionId) {
        return reunionRepository.findById(reunionId)
                .orElseThrow(() -> new IllegalArgumentException("Reunion not found: " + reunionId));
    }

    private ReunionGuest loadGuest(Reunion r, UUID guestId) {
        return guestRepository.findById(guestId)
                .filter(g -> g.getReunion() != null && g.getReunion().getId().equals(r.getId()))
                .orElseThrow(() -> new IllegalArgumentException("Guest not found: " + guestId));
    }

    private List<ReunionGuest> guestsOf(Reunion r) {
        return guestRepository.findByReunionIdOrderByCreatedAtAsc(r.getId());
    }

    private User getUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private String nameOf(User u) {
        return DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, u);
    }

    private static boolean isElder(Reunion r, UUID callerId) {
        return callerId.equals(r.getElder().getId());
    }

    private static boolean isOrganiser(Reunion r, UUID callerId) {
        return r.getOrganiser() != null && callerId.equals(r.getOrganiser().getId());
    }

    private static void assertParty(Reunion r, UUID callerId) {
        if (!isElder(r, callerId) && !isOrganiser(r, callerId)) throw new ForbiddenException(NOT_A_PARTY);
    }

    private static void assertElder(Reunion r, UUID callerId, String message) {
        if (!isElder(r, callerId)) {
            if (!isOrganiser(r, callerId)) throw new ForbiddenException(NOT_A_PARTY);
            throw new ForbiddenException(message);
        }
    }

    private static void assertOrganiser(Reunion r, UUID callerId) {
        if (!isOrganiser(r, callerId)) {
            if (!isElder(r, callerId)) throw new ForbiddenException(NOT_A_PARTY);
            throw new ForbiddenException(ORGANISER_ONLY);
        }
    }

    private static void assertStepIn(Reunion r, ReunionStep... steps) {
        if (!Arrays.asList(steps).contains(r.getStep())) throw new IllegalArgumentException(WRONG_STEP);
    }

    private void push(User to, String title, String body, Reunion r) {
        if (to == null) return;
        try {
            expoPushService.sendToUser(to.getId(), title, body,
                    Map.of("type", "reunion", "reunionId", r.getId().toString()));
        } catch (RuntimeException e) {
            // A push is a courtesy; the step already moved and the page will show it.
            log.warn("Reunion push to {} failed: {}", to.getId(), e.getMessage());
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }
}
