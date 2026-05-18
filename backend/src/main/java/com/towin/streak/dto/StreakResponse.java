package com.towin.streak.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class StreakResponse {
    private int currentStreak;
    private int longestStreak;
    private LocalDate lastCheckinDate;
    private boolean alreadyCheckedIn;
}
