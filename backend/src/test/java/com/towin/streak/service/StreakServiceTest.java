package com.towin.streak.service;

import com.towin.streak.dto.StreakResponse;
import com.towin.streak.entity.UserStreak;
import com.towin.streak.repository.UserStreakRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class StreakServiceTest {

    @Mock UserStreakRepository streakRepository;
    @InjectMocks StreakService streakService;

    UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() { MockitoAnnotations.openMocks(this); }

    @Test
    void firstCheckIn_startsStreakAtOne() {
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(streakRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.getCurrentStreak()).isEqualTo(1);
        assertThat(r.isAlreadyCheckedIn()).isFalse();
    }

    @Test
    void consecutiveDayCheckIn_incrementsStreak() {
        UserStreak existing = UserStreak.builder()
                .userId(userId).currentStreak(4).longestStreak(4)
                .lastCheckinDate(LocalDate.now().minusDays(1)).build();
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.of(existing));
        when(streakRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.getCurrentStreak()).isEqualTo(5);
        assertThat(r.getLongestStreak()).isEqualTo(5);
        assertThat(r.isAlreadyCheckedIn()).isFalse();
    }

    @Test
    void missedDayCheckIn_resetsStreakToOne() {
        UserStreak existing = UserStreak.builder()
                .userId(userId).currentStreak(10).longestStreak(10)
                .lastCheckinDate(LocalDate.now().minusDays(3)).build();
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.of(existing));
        when(streakRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.getCurrentStreak()).isEqualTo(1);
        assertThat(r.getLongestStreak()).isEqualTo(10);
        assertThat(r.isAlreadyCheckedIn()).isFalse();
    }

    @Test
    void sameDay_secondCheckIn_returnsAlreadyCheckedIn() {
        UserStreak existing = UserStreak.builder()
                .userId(userId).currentStreak(3).longestStreak(3)
                .lastCheckinDate(LocalDate.now()).build();
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.of(existing));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.isAlreadyCheckedIn()).isTrue();
        assertThat(r.getCurrentStreak()).isEqualTo(3);
    }
}
