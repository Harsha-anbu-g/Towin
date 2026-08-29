package com.towinly.block.service;

import com.towinly.block.dto.BlockResponse;
import com.towinly.block.entity.UserBlock;
import com.towinly.block.repository.UserBlockRepository;
import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HARD-106: a block lives on the server, so it survives a reinstall, reaches a second
 * device, and applies on the web. The service is the one authority on who is hidden from
 * whom; every listing and every write path asks it and nothing else.
 */
@ExtendWith(MockitoExtension.class)
class BlockServiceTest {

    @Mock UserBlockRepository blockRepository;
    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @InjectMocks BlockService blockService;

    private User me;
    private User them;

    @BeforeEach
    void setUp() {
        me = buildUser(UUID.randomUUID(), "me");
        them = buildUser(UUID.randomUUID(), "them");
    }

    @Test
    void block_refusesBlockingYourself() {
        assertThatThrownBy(() -> blockService.block(me.getId(), me.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(BlockService.CANNOT_BLOCK_SELF);
        verify(blockRepository, never()).save(any());
    }

    @Test
    void block_savesThePairOnceAndNamesThePerson() {
        when(userRepository.findById(me.getId())).thenReturn(Optional.of(me));
        when(userRepository.findById(them.getId())).thenReturn(Optional.of(them));
        when(blockRepository.findByBlockerIdAndBlockedId(me.getId(), them.getId())).thenReturn(Optional.empty());
        when(blockRepository.save(any(UserBlock.class))).thenAnswer(i -> {
            UserBlock b = i.getArgument(0);
            b.setId(UUID.randomUUID());
            b.setCreatedAt(LocalDateTime.now());
            return b;
        });

        BlockResponse response = blockService.block(me.getId(), them.getId());

        ArgumentCaptor<UserBlock> saved = ArgumentCaptor.forClass(UserBlock.class);
        verify(blockRepository).save(saved.capture());
        assertThat(saved.getValue().getBlocker().getId()).isEqualTo(me.getId());
        assertThat(saved.getValue().getBlocked().getId()).isEqualTo(them.getId());
        assertThat(response.getUserId()).isEqualTo(them.getId());
        assertThat(response.getName()).isNotBlank();
    }

    @Test
    void block_isIdempotent_aSecondBlockOfTheSamePersonSavesNothing() {
        when(userRepository.findById(them.getId())).thenReturn(Optional.of(them));
        UserBlock existing = UserBlock.builder().id(UUID.randomUUID()).blocker(me).blocked(them)
                .createdAt(LocalDateTime.now().minusDays(1)).build();
        when(blockRepository.findByBlockerIdAndBlockedId(me.getId(), them.getId())).thenReturn(Optional.of(existing));

        BlockResponse response = blockService.block(me.getId(), them.getId());

        verify(blockRepository, never()).save(any());
        assertThat(response.getUserId()).isEqualTo(them.getId());
    }

    @Test
    void unblock_deletesThePairAndNothingElse() {
        blockService.unblock(me.getId(), them.getId());
        verify(blockRepository).deleteByBlockerIdAndBlockedId(me.getId(), them.getId());
    }

    @Test
    void hiddenFor_holdsBothDirections() {
        UUID iBlocked = UUID.randomUUID();
        UUID blockedMe = UUID.randomUUID();
        when(blockRepository.findHiddenUserIds(me.getId())).thenReturn(List.of(iBlocked, blockedMe, iBlocked));

        Set<UUID> hidden = blockService.hiddenFor(me.getId());

        assertThat(hidden).containsExactlyInAnyOrder(iBlocked, blockedMe);
    }

    @Test
    void hiddenFor_isEmptyWhenNobodyIsBlocked() {
        when(blockRepository.findHiddenUserIds(me.getId())).thenReturn(List.of());
        assertThat(blockService.hiddenFor(me.getId())).isEmpty();
    }

    @Test
    void isHidden_asksTheRepositoryForEitherDirection() {
        when(blockRepository.existsBetween(me.getId(), them.getId())).thenReturn(true);
        assertThat(blockService.isHidden(me.getId(), them.getId())).isTrue();
    }

    @Test
    void sync_insertsOnlyTheIdsTheServerLacks_andSkipsSelfAndUnknownAccounts() {
        UUID alreadyThere = them.getId();
        User newcomer = buildUser(UUID.randomUUID(), "newcomer");
        UUID goneAccount = UUID.randomUUID();
        when(userRepository.findById(me.getId())).thenReturn(Optional.of(me));
        when(userRepository.findById(newcomer.getId())).thenReturn(Optional.of(newcomer));
        when(userRepository.findById(goneAccount)).thenReturn(Optional.empty());
        when(blockRepository.findByBlockerIdAndBlockedId(me.getId(), alreadyThere))
                .thenReturn(Optional.of(UserBlock.builder().blocker(me).blocked(them).createdAt(LocalDateTime.now()).build()));
        when(blockRepository.findByBlockerIdAndBlockedId(me.getId(), newcomer.getId())).thenReturn(Optional.empty());
        when(blockRepository.save(any(UserBlock.class))).thenAnswer(i -> i.getArgument(0));
        when(blockRepository.findAllByBlockerIdOrderByCreatedAtDesc(me.getId())).thenReturn(List.of(
                UserBlock.builder().blocker(me).blocked(them).createdAt(LocalDateTime.now()).build(),
                UserBlock.builder().blocker(me).blocked(newcomer).createdAt(LocalDateTime.now()).build()));

        List<BlockResponse> all = blockService.sync(me.getId(), List.of(alreadyThere, newcomer.getId(), me.getId(), goneAccount));

        verify(blockRepository, times(1)).save(any(UserBlock.class));
        assertThat(all).extracting(BlockResponse::getUserId).containsExactly(them.getId(), newcomer.getId());
    }

    @Test
    void listBlocked_returnsNewestFirstWithNames() {
        when(blockRepository.findAllByBlockerIdOrderByCreatedAtDesc(me.getId())).thenReturn(List.of(
                UserBlock.builder().blocker(me).blocked(them).createdAt(LocalDateTime.now()).build()));

        List<BlockResponse> list = blockService.listBlocked(me.getId());

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getUserId()).isEqualTo(them.getId());
        assertThat(list.get(0).getName()).isNotBlank();
    }

    private User buildUser(UUID id, String username) {
        return User.builder()
                .id(id)
                .username(username)
                .email(username + "@test.com")
                .phone("+1" + Math.abs(username.hashCode()))
                .passwordHash("hash")
                .role(UserRole.ELDER)
                .trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .build();
    }
}
