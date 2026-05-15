package com.towin.need.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ApplicationStatus;
import com.towin.common.enums.NeedStatus;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
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
    private final TrustScoreService trustScoreService;

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
        return needRepository.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN)
                .stream()
                .map(n -> toResponse(n, null))
                .collect(Collectors.toList());
    }

    public List<NeedResponse> browseNearby(UUID helperId, Double lat, Double lng, Double radiusKm, int page, int size) {
        User helper = getUser(helperId);
        double helperLat = lat != null ? lat : (helper.getLocationLat() != null ? helper.getLocationLat().doubleValue() : 0);
        double helperLng = lng != null ? lng : (helper.getLocationLng() != null ? helper.getLocationLng().doubleValue() : 0);

        return needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)
                .stream()
                .map(n -> {
                    double dist = haversineKm(helperLat, helperLng,
                            n.getLocationLat().doubleValue(), n.getLocationLng().doubleValue());
                    return new Object[]{n, dist};
                })
                .filter(pair -> (double) pair[1] <= radiusKm)
                .sorted((a, b) -> Double.compare((double) a[1], (double) b[1]))
                .skip((long) page * size)
                .limit(size)
                .map(pair -> toResponse((Need) pair[0], (double) pair[1]))
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
        return toResponse(needRepository.save(need), null);
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

    private NeedResponse toResponse(Need need, Double distanceKm) {
        return toResponse(need, distanceKm, false);
    }

    private NeedResponse toResponse(Need need, Double distanceKm, boolean includeApplicants) {
        String elderName = elderProfileRepository.findByUserId(need.getElder().getId())
                .map(p -> p.getName())
                .orElse(need.getElder().getEmail());

        List<ApplicantDto> applications = null;
        if (includeApplicants) {
            applications = applicationRepository.findByNeedId(need.getId()).stream()
                    .map(a -> {
                        String helperName = helperProfileRepository.findByUserId(a.getHelper().getId())
                                .map(p -> p.getName())
                                .orElse(a.getHelper().getEmail());
                        return ApplicantDto.builder()
                                .helperId(a.getHelper().getId())
                                .helperName(helperName)
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
