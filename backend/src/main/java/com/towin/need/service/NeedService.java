package com.towin.need.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ApplicationStatus;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.NeedStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.messaging.ConnectionEvent;
import com.towin.common.messaging.ConnectionEventProducer;
import com.towin.common.repository.UserRepository;
import com.towin.common.seed.DemoDataSeeder;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.need.dto.ApplicantDto;
import com.towin.need.dto.ApplyRequest;
import com.towin.need.dto.NeedRequest;
import com.towin.need.dto.NeedResponse;
import com.towin.need.entity.Need;
import com.towin.need.entity.NeedApplication;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NeedService {

    private final NeedRepository needRepository;
    private final NeedApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final S3Service s3Service;
    private final TrustScoreService trustScoreService;
    private final ConnectionRepository connectionRepository;
    private final Optional<ConnectionEventProducer> connectionEventProducer;

    @Transactional
    public NeedResponse postNeed(UUID elderId, NeedRequest request) {
        User elder = getUser(elderId);

        BigDecimal lat = request.getLocationLat() != null
                ? BigDecimal.valueOf(request.getLocationLat())
                : elder.getLocationLat();
        BigDecimal lng = request.getLocationLng() != null
                ? BigDecimal.valueOf(request.getLocationLng())
                : elder.getLocationLng();

        Need need = Need.builder()
                .elder(elder)
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
        Map<UUID, ApplicationStatus> myApps = helperApplicationMap(helperId);
        return needRepository.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN)
                .stream()
                .map(n -> toResponse(n, null, false, myApps.get(n.getId())))
                .collect(Collectors.toList());
    }

    public List<NeedResponse> browseNearby(UUID helperId, Double lat, Double lng, Double radiusKm, int page, int size) {
        User helper = getUser(helperId);
        Map<UUID, ApplicationStatus> myApps = helperApplicationMap(helperId);
        double helperLat = lat != null ? lat : (helper.getLocationLat() != null ? helper.getLocationLat().doubleValue() : 0);
        double helperLng = lng != null ? lng : (helper.getLocationLng() != null ? helper.getLocationLng().doubleValue() : 0);

        List<Object[]> ranked = needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)
                .stream()
                .map(n -> new Object[]{n, haversineKm(helperLat, helperLng,
                        n.getLocationLat().doubleValue(), n.getLocationLng().doubleValue())})
                .sorted((a, b) -> Double.compare((double) a[1], (double) b[1]))
                .collect(Collectors.toList());

        List<Object[]> withinRadius = ranked.stream()
                .filter(pair -> (double) pair[1] <= radiusKm)
                .collect(Collectors.toList());

        // Sample/demo accounts must never show an empty list — if nothing is within the
        // radius, fall back to the nearest open needs so the demo always has something.
        List<Object[]> visible = (withinRadius.isEmpty() && isDemoAccount(helper)) ? ranked : withinRadius;

        return visible.stream()
                .skip((long) page * size)
                .limit(size)
                .map(pair -> {
                    Need n = (Need) pair[0];
                    return toResponse(n, (double) pair[1], false, myApps.get(n.getId()));
                })
                .collect(Collectors.toList());
    }

    public List<NeedResponse> getMyApplications(UUID helperId) {
        return applicationRepository.findByHelperId(helperId).stream()
                .filter(a -> a.getStatus() != ApplicationStatus.WITHDRAWN)
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(a -> toResponse(a.getNeed(), null, false, a.getStatus()))
                .collect(Collectors.toList());
    }

    public Page<NeedResponse> getMyNeeds(UUID elderId, int page, int size) {
        return needRepository.findByElderIdOrderByCreatedAtDesc(elderId, PageRequest.of(page, size))
                .map(n -> toResponse(n, null, true));
    }

    @Transactional
    public void apply(UUID helperId, UUID needId, ApplyRequest request) {
        Need need = getNeed(needId);
        if (need.getStatus() != NeedStatus.OPEN) {
            throw new IllegalArgumentException("Need is not open for applications");
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
    }

    @Transactional
    public NeedResponse acceptHelper(UUID elderId, UUID needId, UUID helperId) {
        Need need = getNeed(needId);
        if (!need.getElder().getId().equals(elderId)) {
            throw new IllegalArgumentException("Only the elder who posted this need can accept a helper");
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
        Connection connection = connectionRepository.findBetweenUsers(elderId, helper.getId())
                .orElseGet(() -> Connection.builder()
                        .userA(need.getElder())
                        .userB(helper)
                        .type(ConnectionType.SERVICE)
                        .initiatedBy(need.getElder())
                        .currentTrustLevel(TrustLevel.DISCOVERED)
                        .status(ConnectionStatus.ACTIVE)
                        .build());
        connection.setStatus(ConnectionStatus.ACTIVE);
        if (connection.getCurrentTrustLevel() == null) {
            connection.setCurrentTrustLevel(TrustLevel.DISCOVERED);
        }
        connection.setConfirmedByUser(need.getElder().getId(), false);
        connection.setConfirmedByUser(helper.getId(), false);
        Connection savedConn = connectionRepository.save(connection);

        connectionEventProducer.ifPresent(p -> p.send(ConnectionEvent.builder()
                .type(ConnectionEvent.Type.REQUEST_ACCEPTED)
                .connectionId(savedConn.getId())
                .senderId(elderId)
                .recipientId(helper.getId())
                .build()));

        return toResponse(needRepository.save(need), null);
    }

    public NeedResponse getOne(UUID callerId, UUID needId) {
        Need need = getNeed(needId);
        // Only the posting elder may see the applicant list (names + free-text messages).
        boolean isOwner = need.getElder().getId().equals(callerId);
        return toResponse(need, null, isOwner);
    }

    @Transactional
    public void cancelNeed(UUID elderId, UUID needId) {
        Need need = getNeed(needId);
        if (!need.getElder().getId().equals(elderId)) {
            throw new IllegalArgumentException("Only the posting elder can cancel this need");
        }
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
    public NeedResponse complete(UUID elderId, UUID needId) {
        Need need = getNeed(needId);
        if (!need.getElder().getId().equals(elderId)) {
            throw new IllegalArgumentException("Only the posting elder can mark a need as complete");
        }
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

    private NeedResponse toResponse(Need need, Double distanceKm, boolean includeApplicants, ApplicationStatus myStatus) {
        String elderName = elderProfileRepository.findByUserId(need.getElder().getId())
                .map(p -> p.getName())
                .orElse(need.getElder().getEmail());

        List<ApplicantDto> applications = null;
        if (includeApplicants) {
            applications = applicationRepository.findByNeedId(need.getId()).stream()
                    .map(a -> {
                        var helperProfile = helperProfileRepository.findByUserId(a.getHelper().getId());
                        String helperName = helperProfile
                                .map(p -> p.getName())
                                .orElse(a.getHelper().getEmail());
                        String helperPhotoUrl = helperProfile
                                .map(p -> s3Service.presignedUrl(p.getPhotoUrl()))
                                .orElse(null);
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
                .build();
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
