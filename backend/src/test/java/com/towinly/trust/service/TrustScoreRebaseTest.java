package com.towinly.trust.service;

import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.TrustScoreRebase;
import com.towinly.common.service.TrustScoreService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrustScoreRebaseTest {

    @Mock UserRepository users;
    @Mock TrustScoreService trustScoreService;
    @InjectMocks TrustScoreRebase rebase;

    private void stalePages(List<UUID> first, List<UUID> second) {
        when(users.findIdsByTrustScoreVersionLessThan(eq(TrustScoreService.CURRENT_VERSION), any(Pageable.class)))
                .thenReturn(first, second);
    }

    @Test
    void recalculatesEveryAccountStillOnAnOlderRule_thenStops() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        stalePages(List.of(a, b), List.of());

        rebase.run(null);

        verify(trustScoreService).recalculate(a);
        verify(trustScoreService).recalculate(b);
    }

    @Test
    void doesNothingWhenEveryAccountIsCurrent() {
        stalePages(List.of(), List.of());

        rebase.run(null);

        verify(trustScoreService, never()).recalculate(any());
    }

    @Test
    void oneAccountThatFails_doesNotBlockTheRest_orLoopForever() {
        UUID broken = UUID.randomUUID();
        UUID fine = UUID.randomUUID();
        // The broken account never gets stamped, so the query keeps returning it.
        stalePages(List.of(broken, fine), List.of(broken));
        doThrow(new IllegalStateException("boom")).when(trustScoreService).recalculate(broken);

        rebase.run(null);

        verify(trustScoreService).recalculate(fine);
        // Tried once this boot, then left for the next one.
        verify(trustScoreService, times(1)).recalculate(broken);
    }
}
