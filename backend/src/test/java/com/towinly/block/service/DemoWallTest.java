package com.towinly.block.service;

import com.towinly.block.repository.UserBlockRepository;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.seed.DemoDataSeeder;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The demo passwords are public, so the demo cast and real members must be hidden
 * from each other the way a block hides two people.
 */
@ExtendWith(MockitoExtension.class)
class DemoWallTest {

    @Mock UserBlockRepository blockRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @InjectMocks BlockService blockService;

    private final UUID demoMargaret = UUID.randomUUID();
    private final UUID demoHelper = UUID.randomUUID();
    private final UUID realElder = UUID.randomUUID();
    private final UUID realHelper = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(userRepository.findIdsByEmailIn(DemoDataSeeder.DEMO_EMAILS))
                .thenReturn(List.of(demoMargaret, demoHelper));
        lenient().when(userRepository.findIdsByEmailNotIn(DemoDataSeeder.DEMO_EMAILS))
                .thenReturn(List.of(realElder, realHelper));
    }

    @Test
    void aDemoSeatAndARealMember_areHiddenFromEachOther_withNoBlockRow() {
        assertThat(blockService.isHidden(demoHelper, realElder)).isTrue();
        assertThat(blockService.isHidden(realElder, demoHelper)).isTrue();
        verify(blockRepository, never()).existsBetween(demoHelper, realElder);
    }

    @Test
    void twoDemoSeats_stillSeeEachOther() {
        when(blockRepository.existsBetween(demoHelper, demoMargaret)).thenReturn(false);
        assertThat(blockService.isHidden(demoHelper, demoMargaret)).isFalse();
    }

    @Test
    void twoRealMembers_answerOnlyToRealBlocks() {
        when(blockRepository.existsBetween(realHelper, realElder)).thenReturn(true);
        assertThat(blockService.isHidden(realHelper, realElder)).isTrue();
    }

    @Test
    void aRealMembersHiddenSet_holdsTheWholeDemoCast() {
        when(blockRepository.findHiddenUserIds(realElder)).thenReturn(List.of());
        assertThat(blockService.hiddenFor(realElder))
                .containsExactlyInAnyOrder(demoMargaret, demoHelper);
    }

    @Test
    void aDemoSeatsHiddenSet_holdsEveryRealMember_andNoDemoOne() {
        when(blockRepository.findHiddenUserIds(demoHelper)).thenReturn(List.of());
        assertThat(blockService.hiddenFor(demoHelper))
                .containsExactlyInAnyOrder(realElder, realHelper)
                .doesNotContain(demoMargaret);
    }
}
