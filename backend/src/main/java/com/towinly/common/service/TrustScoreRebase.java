package com.towinly.common.service;

import com.towinly.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Brings every stored trust score onto the current scoring rule, once.
 *
 * <p>A stored score only moves when something happens to its owner, so a change to
 * the rule itself (TrustScoreService.CURRENT_VERSION) would otherwise leave old
 * numbers on screen until each person's next event. On boot this recalculates the
 * accounts still stamped with an older rule; recalculate() stamps them current, so
 * the next boot finds nothing to do.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TrustScoreRebase implements ApplicationRunner {

    static final int PAGE_SIZE = 200;

    private final UserRepository users;
    private final TrustScoreService trustScoreService;

    @Override
    public void run(ApplicationArguments args) {
        int done = 0;
        // An account that fails stays stamped old and would come back on every page.
        Set<UUID> failed = new HashSet<>();
        while (true) {
            List<UUID> todo = users.findIdsByTrustScoreVersionLessThan(
                            TrustScoreService.CURRENT_VERSION, PageRequest.of(0, PAGE_SIZE))
                    .stream().filter(id -> !failed.contains(id)).toList();
            if (todo.isEmpty()) break;
            for (UUID id : todo) {
                try {
                    trustScoreService.recalculate(id);
                    done++;
                } catch (Exception e) {
                    failed.add(id);
                    log.warn("Trust score rebase skipped {}: {}", id, e.getMessage());
                }
            }
        }
        if (done > 0 || !failed.isEmpty()) {
            log.info("Trust score rebase: {} recalculated, {} left for the next boot", done, failed.size());
        }
    }
}
