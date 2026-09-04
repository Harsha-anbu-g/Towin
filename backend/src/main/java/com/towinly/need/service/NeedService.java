package com.towinly.need.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ApplicationStatus;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.NeedStatus;
import com.towinly.common.enums.TrustLevel;
import com.towinly.common.messaging.ConnectionEvent;
import com.towinly.common.messaging.ConnectionEventProducer;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.seed.DemoDataSeeder;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.common.service.S3Service;
import com.towinly.common.service.TrustScoreService;
import com.towinly.common.web.PageLimits;
import com.towinly.connection.entity.Connection;
import com.towinly.common.enums.DelegatedPower;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.family.service.FamilyDelegationService;
import com.towinly.need.dto.ApplicantDto;
import com.towinly.need.dto.ApplyRequest;
import com.towinly.need.dto.NeedRequest;
import com.towinly.need.dto.NeedResponse;
import com.towinly.need.entity.Need;
import com.towinly.need.entity.NeedApplication;
import com.towinly.need.repository.NeedApplicationRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.notification.service.ExpoPushService;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.block.service.BlockService;
import com.towinly.common.service.CoarseLocation;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NeedService {

    // Same bound as /needs/nearby: the open-needs feed is a browse list, not an archive.
    // SEC-07's numbers, so the three browse routes in this class cannot drift apart.
    public static final int DEFAULT_PAGE_SIZE = PageLimits.DEFAULT_PAGE_SIZE;

    private final NeedRepository needRepository;
    private final NeedApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final S3Service s3Service;
    private final TrustScoreService trustScoreService;
    private final ConnectionRepository connectionRepository;
    private final Optional<ConnectionEventProducer> connectionEventProducer;
    private final FamilyDelegationService familyDelegationService;
    private final ExpoPushService expoPushService;
    private final BlockService blockService;

    @Transactional
    public NeedResponse postNeed(UUID callerId, NeedRequest request) {
        // Guardian mode: a family member the parent trusts with their help requests
        // may post one for them. The request belongs to the parent — helpers see it
        // as the parent's, it sits with the parent's other requests, and it uses the
        // parent's home address — so nothing about how it works changes. The family
        // member is simply named as the one who wrote it.
        User actedBy = null;
        UUID elderId = callerId;
        if (request.getOnBehalfOfElderId() != null) {
            familyDelegationService.assertDelegated(
                    callerId, request.getOnBehalfOfElderId(), DelegatedPower.MANAGE_HELP_REQUESTS);
            elderId = request.getOnBehalfOfElderId();
            actedBy = getUser(callerId);
        }
        User elder = getUser(elderId);

        // SEC-01: a request carries a place, so it is snapped to the same 0.02
        // degree cell as a profile before it is stored. /needs/nearby answers a
        // distance from a caller-chosen origin, so a precise point here would
        // locate the elder's home just as surely as their profile would. The
        // elder's own stored coordinate is already on the grid, and snapping is
        // idempotent, so the fallback branch costs nothing.
        // A family member posting for their parent may be anywhere: their own
        // phone's cell is not the parent's home, and the request is the parent's.
        // So an on-behalf post always uses the elder's stored position and the
        // body's coordinates are ignored.
        boolean onBehalf = actedBy != null;
        BigDecimal lat = (!onBehalf && request.getLocationLat() != null)
                ? CoarseLocation.snap(request.getLocationLat())
                : CoarseLocation.snap(elder.getLocationLat());
        BigDecimal lng = (!onBehalf && request.getLocationLng() != null)
                ? CoarseLocation.snapLng(request.getLocationLng())
                : CoarseLocation.snapLng(elder.getLocationLng());

        Need need = Need.builder()
                .elder(elder)
                .actedBy(actedBy)
                .title(request.getTitle())
                .category(request.getCategory())
                .description(request.getDescription())
                .schedule(request.getSchedule())
                .urgency(request.getUrgency())
                .locationLat(lat)
                .locationLng(lng)
                .build();

        return toResponse(needRepository.save(need), null);
    }

    public List<NeedResponse> getAllOpen(UUID helperId) {
        return getAllOpen(helperId, PageRequest.of(0, DEFAULT_PAGE_SIZE));
    }

    public List<NeedResponse> getAllOpen(UUID helperId, Pageable requested) {
        // SEC-07: how much of the feed one request may take is the server's decision.
        // Spring's own ceiling is 2000 rows, and every row carries an elder's name,
        // title and description. The sort is carried across untouched - only the size
        // moves - so a caller asking for 100000 gets a normal page, not an error.
        // An unpaged request asks for the whole table, which is the hole itself, so it
        // is answered with the default page rather than honoured.
        Pageable pageable = requested.isPaged()
                ? PageRequest.of(
                        PageLimits.page(requested.getPageNumber()),
                        PageLimits.size(requested.getPageSize()),
                        requested.getSort())
                : PageRequest.of(0, DEFAULT_PAGE_SIZE);
        Map<UUID, ApplicationStatus> myApps = helperApplicationMap(helperId);
        // HARD-106: a blocked elder's requests never reach this helper's feed, either way round.
        // With nobody hidden the page comes straight from the database. With a block
        // in play the filter must run BEFORE the page is cut, or a page can come back
        // short (even empty) while later pages hold visible requests.
        Set<UUID> hidden = blockService.hiddenFor(helperId);
        List<Need> needs = hidden.isEmpty()
                ? needRepository.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN, pageable)
                : needRepository.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN).stream()
                        .filter(n -> !hidden.contains(n.getElder().getId()))
                        .skip(pageable.getOffset())
                        .limit(pageable.getPageSize())
                        .collect(Collectors.toList());
        Map<UUID, String> elderNames = elderNameMap(needs);
        return needs.stream()
                .map(n -> toResponse(n, null, false, myApps.get(n.getId()), elderNames))
                .collect(Collectors.toList());
    }

    public List<NeedResponse> browseNearby(UUID helperId, Double lat, Double lng, Double radiusKm,
                                           int requestedPage, int requestedSize) {
        // SEC-07: ?size=100000&radiusKm=100000 used to hand back every open request in
        // one response - each one a named elder, a title that often says the private
        // thing itself, and a distance. The bounds are the server's, the same numbers
        // /api/discover uses. Clamped, never refused: a stale link keeps working, and
        // "?radiusKm=" (which binds to null) no longer unboxes into a 500.
        int page = PageLimits.page(requestedPage);
        int size = PageLimits.size(requestedSize);
        double radius = PageLimits.radiusKm(radiusKm);
        User helper = getUser(helperId);
        Map<UUID, ApplicationStatus> myApps = helperApplicationMap(helperId);
        double helperLat = lat != null ? lat : (helper.getLocationLat() != null ? helper.getLocationLat().doubleValue() : 0);
        double helperLng = lng != null ? lng : (helper.getLocationLng() != null ? helper.getLocationLng().doubleValue() : 0);

        Set<UUID> hidden = blockService.hiddenFor(helperId);
        List<Object[]> ranked = needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)
                .stream()
                .filter(n -> !hidden.contains(n.getElder().getId()))
                .map(n -> new Object[]{n, haversineKm(helperLat, helperLng,
                        n.getLocationLat().doubleValue(), n.getLocationLng().doubleValue())})
                .sorted((a, b) -> Double.compare((double) a[1], (double) b[1]))
                .collect(Collectors.toList());

        List<Object[]> withinRadius = ranked.stream()
                .filter(pair -> (double) pair[1] <= radius)
                .collect(Collectors.toList());

        // Sample/demo accounts must never show an empty list — if nothing is within the
        // radius, fall back to the nearest open needs so the demo always has something.
        List<Object[]> visible = (withinRadius.isEmpty() && isDemoAccount(helper)) ? ranked : withinRadius;

        List<Object[]> pageSlice = visible.stream()
                .skip((long) page * size)
                .limit(size)
                .collect(Collectors.toList());

        Map<UUID, String> elderNames = elderNameMap(pageSlice.stream()
                .map(pair -> (Need) pair[0])
                .collect(Collectors.toList()));

        return pageSlice.stream()
                .map(pair -> {
                    Need n = (Need) pair[0];
                    return toResponse(n, (double) pair[1], false, myApps.get(n.getId()), elderNames);
                })
                .collect(Collectors.toList());
    }

    /**
     * The helper's own offers and jobs, newest first: withdrawn ones gone, and nothing
     * belonging to anyone blocked in either direction.
     */
    public List<NeedResponse> getMyApplications(UUID helperId) {
        // SEC-04 by another route. Every row here carries the elder's title,
        // description, name and LIVE status - exactly what GET /needs/{id} now refuses
        // across a block - and the app polls this list, so a blocked helper kept
        // watching a named person's home through it: ASSIGNED says a stranger has been
        // let in, COMPLETED says when they left. So it subtracts blocks like the two
        // feeds above it, and like the applicant list the elder sees.
        //
        // The whole row goes rather than a stripped one. A block already removes this
        // pair from every other surface: the offer leaves the elder's applicant list,
        // her requests leave both feeds, the friendship leaves the connections list and
        // the chat is closed. A row kept back as an id and a status would be the only
        // trace left of a relationship that has vanished everywhere else, and both
        // clients build these rows out of the elder's own fields (title, name,
        // category), so a hollowed-out row draws as a blank line. Nothing is lost:
        // unblocking brings the offer and its history straight back.
        Set<UUID> hidden = blockService.hiddenFor(helperId);
        List<NeedApplication> applications = applicationRepository.findByHelperId(helperId).stream()
                .filter(a -> a.getStatus() != ApplicationStatus.WITHDRAWN)
                .filter(a -> !hidden.contains(a.getNeed().getElder().getId()))
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .collect(Collectors.toList());
        Map<UUID, String> elderNames = elderNameMap(applications.stream()
                .map(NeedApplication::getNeed)
                .collect(Collectors.toList()));
        return applications.stream()
                .map(a -> toResponse(a.getNeed(), null, false, a.getStatus(), elderNames))
                .collect(Collectors.toList());
    }

    public Page<NeedResponse> getMyNeeds(UUID elderId, int page, int size) {
        // SEC-07, and it also stops a 500: PageRequest.of throws on a negative page or
        // a zero size, so ?page=-1 used to be an error screen on the elder's own list.
        Page<Need> needs = needRepository.findByElderIdOrderByCreatedAtDesc(
                elderId, PageRequest.of(PageLimits.page(page), PageLimits.size(size)));
        Map<UUID, String> elderNames = elderNameMap(needs.getContent());
        return needs.map(n -> toResponse(n, null, true, null, elderNames));
    }

    @Transactional
    public void apply(UUID helperId, UUID needId, ApplyRequest request) {
        Need need = getNeed(needId);
        if (need.getStatus() != NeedStatus.OPEN) {
            throw new IllegalArgumentException("Need is not open for applications");
        }
        // HARD-106: an offer across a block is refused without saying why.
        if (blockService.isHidden(helperId, need.getElder().getId())) {
            throw new IllegalStateException(BlockService.NOT_AVAILABLE);
        }
        // Guardian mode: the family member who looks after this parent's help
        // requests sits on the deciding side of them, so she must not also stand on
        // the answering side. Narrow on purpose — it asks about this one need's
        // owner and this one power, so an ordinary helper (who holds no power at
        // all) is never even a question, and a family member without the power can
        // still offer to help her parent like anyone else.
        if (familyDelegationService.hasPower(
                helperId, need.getElder().getId(), DelegatedPower.MANAGE_HELP_REQUESTS)) {
            throw new IllegalArgumentException(
                    "You look after this request for them, so you can't also answer it yourself.");
        }
        if (applicationRepository.existsByNeedIdAndHelperId(needId, helperId)) {
            throw new IllegalArgumentException("You have already applied to this need");
        }

        User helper = getUser(helperId);
        NeedApplication application = NeedApplication.builder()
                .need(need)
                .helper(helper)
                .message(request != null ? request.getMessage() : null)
                .build();
        applicationRepository.save(application);

        // The offer is the marketplace's heartbeat, and the person it belongs
        // to is usually at home with the phone locked. Ping the elder who owns
        // the need; deferred past commit by ExpoPushService. The body names no
        // need title: titles are free text and often say the private thing
        // itself ("get to my dialysis appointment"), and a lock screen is not
        // a private place (2026-08-16 security review). The tap opens the
        // request, which is where the detail belongs.
        expoPushService.sendToUser(need.getElder().getId(),
                DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, helper),
                "offered to help with your request.",
                Map.of("type", "need", "needId", need.getId().toString()));
    }

    @Transactional
    public NeedResponse acceptHelper(UUID callerId, UUID needId, UUID helperId) {
        Need need = getNeed(needId);
        User actingFor = authorizeRequestOwner(need, callerId,
                "Only the elder who posted this need can accept a helper");
        // Guardian mode, the one thing a family member must never do: choose
        // themselves. Without this, someone trusted only with the parent's help
        // requests could write a request, offer to help with it, pick herself, and
        // mark it done — inventing a finished job, a connection to her own parent
        // and the trust that comes with it, with nobody else ever involved.
        // Who comes into your home is the parent's own decision, and a family
        // member must never be on both sides of it.
        if (actingFor != null && helperId.equals(callerId)) {
            throw new IllegalArgumentException(
                    "You can't pick yourself to help. Choosing who comes to help is theirs to decide.");
        }
        // Everything below is the elder's, never the caller's: the new connection is
        // between the elder and the helper. A family member accepting for their
        // parent must not quietly put themselves on that connection instead.
        UUID elderId = need.getElder().getId();
        // HARD-106: an application that predates a block can never be accepted
        // across it; accepting would create a connection and push a notification
        // naming the blocker to the person they blocked.
        if (blockService.isHidden(elderId, helperId)) {
            throw new IllegalStateException(BlockService.NOT_AVAILABLE);
        }
        if (need.getStatus() != NeedStatus.OPEN) {
            throw new IllegalArgumentException("Need is not open");
        }

        NeedApplication application = applicationRepository.findByNeedIdAndHelperId(needId, helperId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));

        application.setStatus(ApplicationStatus.ACCEPTED);
        applicationRepository.save(application);

        applicationRepository.findByNeedId(needId).stream()
                .filter(a -> !a.getHelper().getId().equals(helperId))
                .forEach(a -> {
                    a.setStatus(ApplicationStatus.REJECTED);
                    applicationRepository.save(a);
                });

        need.setStatus(NeedStatus.ASSIGNED);

        User helper = application.getHelper();
        // List read — a doubled pair (see ConnectionRepository.findAllBetweenUsers)
        // must not 500 the accept. A live row is preferred; failing that, any row is
        // reused, and the rung reset below treats it as the dead row it is.
        List<Connection> pairRows = connectionRepository.findAllBetweenUsers(elderId, helper.getId());
        Connection existing = pairRows.stream()
                .filter(c -> c.getStatus() == ConnectionStatus.ACTIVE
                        || c.getStatus() == ConnectionStatus.PAUSED)
                .findFirst()
                .orElseGet(() -> pairRows.isEmpty() ? null : pairRows.get(0));
        // A pause is the one non-live state that keeps its rung, because a pause is
        // reversible by design: TrustService.resumeProgression hands the same rung back
        // on one press, and the app promises nothing is lost while a friendship is
        // paused. Accepting this helper's offer is the elder asking for them again, so
        // it must not quietly wipe a ladder the two of them actually climbed.
        boolean wasLive = existing != null
                && (existing.getStatus() == ConnectionStatus.ACTIVE
                        || existing.getStatus() == ConnectionStatus.PAUSED);
        Connection connection = existing != null ? existing : Connection.builder()
                .userA(need.getElder())
                .userB(helper)
                .type(ConnectionType.SERVICE)
                .initiatedBy(need.getElder())
                .currentTrustLevel(TrustLevel.DISCOVERED)
                .status(ConnectionStatus.ACTIVE)
                .build();
        connection.setStatus(ConnectionStatus.ACTIVE);
        // Whatever rung a dead row died on dies with it. Accepting an offer reuses the
        // one row the pair are allowed, so a PENDING, DECLINED or ENDED row used to
        // come back ACTIVE still standing where it stopped - and the rung is what opens
        // the phone number (SEC-02: ACTIVE and Phone Ready). The score head start makes
        // that a two-step harvest: a helper scoring 51 or more sends a friend request
        // that starts at Phone Ready, the elder turns it down, the helper offers on any
        // open request, and being accepted hands over her number with no ladder step
        // ever taken. Coming back is a new beginning, so it begins at the bottom.
        if (!wasLive || connection.getCurrentTrustLevel() == null) {
            connection.setCurrentTrustLevel(TrustLevel.DISCOVERED);
        }
        connection.resetConfirmations();
        Connection savedConn = connectionRepository.save(connection);

        connectionEventProducer.ifPresent(p -> p.send(ConnectionEvent.builder()
                .type(ConnectionEvent.Type.REQUEST_ACCEPTED)
                .connectionId(savedConn.getId())
                .senderId(elderId)
                .recipientId(helper.getId())
                .build()));

        // Being chosen is the news a helper waits for. The name shown is the
        // elder's, never the family member who clicked accept on their behalf:
        // the connection made here is the elder's own, and the ping says so.
        expoPushService.sendToUser(helper.getId(),
                DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, need.getElder()),
                "accepted your offer to help.",
                Map.of("type", "need_accepted",
                        "needId", need.getId().toString(),
                        "connectionId", savedConn.getId().toString()));

        return toResponse(needRepository.save(need), null);
    }

    public NeedResponse getOne(UUID callerId, UUID needId) {
        Need need = getNeed(needId);
        // HARD-106: reading one request by its id is refused across a block, the same
        // way the feeds already drop it. Without this a blocked helper kept the id
        // from the open feed and went on reading the request and its live status.
        if (blockService.isHidden(callerId, need.getElder().getId())) {
            throw new IllegalStateException(BlockService.NOT_AVAILABLE);
        }
        // Only the posting elder may see the applicant list (names + free-text
        // messages) — and the family member they trusted to pick a helper for them,
        // who cannot choose one without reading who applied.
        boolean isOwner = need.getElder().getId().equals(callerId)
                || familyDelegationService.hasPower(
                        callerId, need.getElder().getId(), DelegatedPower.MANAGE_HELP_REQUESTS);
        return toResponse(need, null, isOwner);
    }

    @Transactional
    public void cancelNeed(UUID callerId, UUID needId) {
        Need need = getNeed(needId);
        authorizeRequestOwner(need, callerId, "Only the posting elder can cancel this need");
        if (need.getStatus() == NeedStatus.COMPLETED) {
            throw new IllegalArgumentException("Cannot cancel a completed need");
        }
        need.setStatus(NeedStatus.CANCELLED);
        needRepository.save(need);
    }

    @Transactional
    public void withdrawApplication(UUID helperId, UUID needId) {
        Need need = getNeed(needId);
        if (need.getStatus() != NeedStatus.OPEN) {
            throw new IllegalArgumentException("Cannot withdraw from a need that is no longer open");
        }
        NeedApplication application = applicationRepository.findByNeedIdAndHelperId(needId, helperId)
                .orElseThrow(() -> new IllegalArgumentException("No application found"));
        if (application.getStatus() != ApplicationStatus.PENDING) {
            throw new IllegalArgumentException("Can only withdraw a pending application");
        }
        applicationRepository.delete(application);
    }

    @Transactional
    public NeedResponse complete(UUID callerId, UUID needId) {
        Need need = getNeed(needId);
        authorizeRequestOwner(need, callerId, "Only the posting elder can mark a need as complete");
        if (need.getStatus() != NeedStatus.ASSIGNED) {
            throw new IllegalArgumentException("Need must be assigned before it can be completed");
        }
        need.setStatus(NeedStatus.COMPLETED);
        NeedResponse response = toResponse(needRepository.save(need), null);

        applicationRepository.findByNeedId(needId).stream()
                .filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .findFirst()
                .ifPresent(a -> trustScoreService.recalculate(a.getHelper().getId()));

        return response;
    }

    /**
     * Who is allowed to run this request: the elder who posted it, or a family
     * member they have trusted with their help requests. Returns the family member
     * when someone is acting for the elder, and null when the elder is doing it
     * themselves — so the caller knows whether a family member is at the keyboard.
     *
     * This is the guard, and only the guard. It never writes anything on the
     * request: "written by" belongs to whoever actually wrote it (set once, in
     * postNeed), and later accepting or completing it must not rewrite that.
     *
     * The grant is re-read here on every single action rather than remembered, so
     * the moment the elder takes the power back the very next action is refused.
     */
    private User authorizeRequestOwner(Need need, UUID callerId, String refusal) {
        if (need.getElder().getId().equals(callerId)) return null;
        if (familyDelegationService.hasPower(
                callerId, need.getElder().getId(), DelegatedPower.MANAGE_HELP_REQUESTS)) {
            return getUser(callerId);
        }
        throw new IllegalArgumentException(refusal);
    }

    private boolean isDemoAccount(User user) {
        return user.getEmail() != null && DemoDataSeeder.DEMO_EMAILS.contains(user.getEmail());
    }

    private Map<UUID, ApplicationStatus> helperApplicationMap(UUID helperId) {
        return applicationRepository.findByHelperId(helperId).stream()
                .collect(Collectors.toMap(a -> a.getNeed().getId(), NeedApplication::getStatus, (a, b) -> a));
    }

    private NeedResponse toResponse(Need need, Double distanceKm) {
        return toResponse(need, distanceKm, false, null);
    }

    private NeedResponse toResponse(Need need, Double distanceKm, boolean includeApplicants) {
        return toResponse(need, distanceKm, includeApplicants, null);
    }

    /** Display names for every elder in the list, in one query — never one lookup per need. */
    private Map<UUID, String> elderNameMap(Collection<Need> needs) {
        Set<UUID> elderIds = needs.stream()
                .map(n -> n.getElder().getId())
                .collect(Collectors.toSet());
        if (elderIds.isEmpty()) return Map.of();
        return elderProfileRepository.findNamesByUserIds(elderIds).stream()
                .collect(Collectors.toMap(row -> (UUID) row[0], row -> (String) row[1]));
    }

    private NeedResponse toResponse(Need need, Double distanceKm, boolean includeApplicants, ApplicationStatus myStatus) {
        return toResponse(need, distanceKm, includeApplicants, myStatus, elderNameMap(List.of(need)));
    }

    private NeedResponse toResponse(Need need, Double distanceKm, boolean includeApplicants,
                                    ApplicationStatus myStatus, Map<UUID, String> elderNames) {
        // Every help request carries the elder's name to whoever is browsing. The
        // batch lookup above only covers elders with a profile, and the fallback
        // used to be their email address — so an elder without a profile had their
        // email shown to every helper in the list.
        String elderName = elderNames.getOrDefault(
                need.getElder().getId(), DisplayNameResolver.fromUser(need.getElder()));

        List<ApplicantDto> applications = null;
        if (includeApplicants) {
            // HARD-106: a blocked helper's application leaves the elder's own list
            // (name, photo and message) the moment the block lands.
            Set<UUID> hidden = blockService.hiddenFor(need.getElder().getId());
            List<NeedApplication> apps = applicationRepository.findByNeedId(need.getId()).stream()
                    .filter(a -> !hidden.contains(a.getHelper().getId()))
                    .collect(Collectors.toList());
            Set<UUID> helperIds = apps.stream()
                    .map(a -> a.getHelper().getId())
                    .collect(Collectors.toSet());
            // One query for all applicant names/photos: rows of [userId, name, photoUrl]
            Map<UUID, Object[]> helperInfo = helperIds.isEmpty() ? Map.of()
                    : helperProfileRepository.findNamesAndPhotosByUserIds(helperIds).stream()
                            .collect(Collectors.toMap(row -> (UUID) row[0], row -> row));
            applications = apps.stream()
                    .map(a -> {
                        Object[] info = helperInfo.get(a.getHelper().getId());
                        String helperName = info != null ? (String) info[1] : a.getHelper().getEmail();
                        String helperPhotoUrl = info != null ? s3Service.presignedUrl((String) info[2]) : null;
                        return ApplicantDto.builder()
                                .helperId(a.getHelper().getId())
                                .helperName(helperName)
                                .helperPhotoUrl(helperPhotoUrl)
                                .message(a.getMessage())
                                .status(a.getStatus())
                                .build();
                    })
                    .collect(Collectors.toList());
        }

        return NeedResponse.builder()
                .id(need.getId())
                .elderId(need.getElder().getId())
                .elderName(elderName)
                .title(need.getTitle())
                .category(need.getCategory())
                .description(need.getDescription())
                .schedule(need.getSchedule())
                .urgency(need.getUrgency())
                .status(need.getStatus())
                .myApplicationStatus(myStatus)
                .distanceKm(distanceKm != null ? Math.round(distanceKm * 10.0) / 10.0 : null)
                .createdAt(need.getCreatedAt())
                .applications(applications)
                // Guardian mode: say plainly who wrote this for the elder. It rides on
                // every response, so a delegated request can never reach a helper
                // without the "who really wrote this" label attached. Only ever the
                // writer — accepting or completing the request later never changes it.
                .actedByName(need.getActedBy() == null ? null : actorName(need.getActedBy()))
                .build();
    }

    /** The family member's own name, for the "Sarah, for Margaret" label. */
    private String actorName(User actor) {
        return DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, actor);
    }

    private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private Need getNeed(UUID needId) {
        return needRepository.findById(needId)
                .orElseThrow(() -> new IllegalArgumentException("Need not found: " + needId));
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
