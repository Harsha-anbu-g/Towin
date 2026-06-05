package com.towin.streak.service;

import com.towin.streak.dto.StreakResponse;
import com.towin.streak.entity.UserStreak;
import com.towin.streak.repository.UserStreakRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StreakService {

    private final UserStreakRepository streakRepository;

    @Transactional
    public StreakResponse checkIn(UUID userId) {
        UserStreak streak = streakRepository.findByUserId(userId)
                .orElseGet(() -> UserStreak.builder().userId(userId).build());

        LocalDate today = LocalDate.now();

        if (today.equals(streak.getLastCheckinDate())) {
            return toResponse(streak, true);
        }

        if (streak.getLastCheckinDate() != null &&
                streak.getLastCheckinDate().equals(today.minusDays(1))) {
            streak.setCurrentStreak(streak.getCurrentStreak() + 1);
        } else {
            streak.setCurrentStreak(1);
        }

        if (streak.getCurrentStreak() > streak.getLongestStreak()) {
            streak.setLongestStreak(streak.getCurrentStreak());
        }

        streak.setLastCheckinDate(today);
        streakRepository.save(streak);

        return toResponse(streak, false);
    }

    public StreakResponse getStreak(UUID userId) {
        UserStreak streak = streakRepository.findByUserId(userId)
                .orElseGet(() -> UserStreak.builder().userId(userId)
                        .currentStreak(0).longestStreak(0).build());
        LocalDate today = LocalDate.now();
        boolean alreadyCheckedIn = today.equals(streak.getLastCheckinDate());
        return toResponse(streak, alreadyCheckedIn);
    }

    private StreakResponse toResponse(UserStreak s, boolean alreadyCheckedIn) {
        return StreakResponse.builder()
                .currentStreak(s.getCurrentStreak())
                .longestStreak(s.getLongestStreak())
                .lastCheckinDate(s.getLastCheckinDate())
                .alreadyCheckedIn(alreadyCheckedIn)
                .build();
    }
}
