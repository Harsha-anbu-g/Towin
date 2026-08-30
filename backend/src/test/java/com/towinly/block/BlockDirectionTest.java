package com.towinly.block;

import com.towinly.block.repository.UserBlockRepository;
import com.towinly.block.service.BlockService;
import com.towinly.common.repository.UserRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * The directional half of BlockService. hiddenFor and isHidden fold both directions together,
 * which is right for cutting contact and wrong wherever the answer depends on WHO cut it:
 * one person's choice must never take away a third party's view of their own family.
 */
@ExtendWith(MockitoExtension.class)
class BlockDirectionTest {

    @Mock UserBlockRepository blockRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @InjectMocks BlockService blockService;

    private final UUID me = UUID.randomUUID();
    private final UUID them = UUID.randomUUID();

    @Test
    void blockedBy_returnsOnlyThePeopleThisUserChoseToBlock() {
        when(blockRepository.findBlockedByUserIds(me)).thenReturn(List.of(them));

        assertThat(blockService.blockedBy(me)).containsExactly(them);
    }

    @Test
    void blockersOf_returnsOnlyThePeopleWhoBlockedThisUser() {
        when(blockRepository.findBlockersOfUserIds(me)).thenReturn(List.of(them));

        assertThat(blockService.blockersOf(me)).containsExactly(them);
    }

    @Test
    void hasBlocked_isOneWayWhereIsHiddenIsBoth() {
        when(blockRepository.findByBlockerIdAndBlockedId(me, them)).thenReturn(Optional.empty());

        assertThat(blockService.hasBlocked(me, them)).isFalse();
    }

    @Test
    void hasBlocked_isTrueOnlyForTheDirectionThatWasActuallyBlocked() {
        when(blockRepository.findByBlockerIdAndBlockedId(me, them))
                .thenReturn(Optional.of(com.towinly.block.entity.UserBlock.builder().build()));

        assertThat(blockService.hasBlocked(me, them)).isTrue();
    }

    @Test
    void emptyRepositoriesGiveEmptySetsRatherThanNull() {
        when(blockRepository.findBlockedByUserIds(me)).thenReturn(List.of());
        when(blockRepository.findBlockersOfUserIds(me)).thenReturn(List.of());

        assertThat(blockService.blockedBy(me)).isEmpty();
        assertThat(blockService.blockersOf(me)).isEmpty();
    }
}
