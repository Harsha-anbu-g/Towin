package com.towinly.block.service;

import com.towinly.block.dto.BlockResponse;
import com.towinly.block.entity.UserBlock;
import com.towinly.block.repository.UserBlockRepository;
import com.towinly.common.entity.User;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Blocks, server-side (HARD-106). The one authority on who is hidden from whom: every
 * listing (connections, discovery, open needs) subtracts {@link #hiddenFor} and every
 * write between two people (a message, a friend request, an offer to help) asks
 * {@link #isHidden}. Both directions count: a block hides each person from the other.
 *
 * The blocked person is never told. Nothing here produces a notification, and the
 * refusals the write paths raise use words that say nothing about a block.
 */
@Service
@RequiredArgsConstructor
public class BlockService {

    static final String CANNOT_BLOCK_SELF = "You cannot block yourself";

    private final UserBlockRepository blockRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;

    /** Hides {@code blockedId} from {@code blockerId} and the other way round. Idempotent. */
    @Transactional
    public BlockResponse block(UUID blockerId, UUID blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new IllegalArgumentException(CANNOT_BLOCK_SELF);
        }
        User blocked = getUser(blockedId);
        UserBlock row = blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId)
                .orElseGet(() -> blockRepository.save(UserBlock.builder()
                        .blocker(getUser(blockerId))
                        .blocked(blocked)
                        .build()));
        return toResponse(row);
    }

    /** Removes the block if there is one. Never an error when there is not. */
    @Transactional
    public void unblock(UUID blockerId, UUID blockedId) {
        blockRepository.deleteByBlockerIdAndBlockedId(blockerId, blockedId);
    }

    /** The people this user has blocked, newest first. */
    public List<BlockResponse> listBlocked(UUID blockerId) {
        return blockRepository.findAllByBlockerIdOrderByCreatedAtDesc(blockerId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Adopts a list a phone already held: inserts the ids the server lacks, skips the
     * caller's own id and accounts that no longer exist, and returns the whole list.
     */
    @Transactional
    public List<BlockResponse> sync(UUID blockerId, Collection<UUID> blockedIds) {
        Set<UUID> wanted = new LinkedHashSet<>(blockedIds);
        wanted.remove(blockerId);
        for (UUID blockedId : wanted) {
            if (blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId).isPresent()) continue;
            userRepository.findById(blockedId).ifPresent(blocked ->
                    blockRepository.save(UserBlock.builder()
                            .blocker(getUser(blockerId))
                            .blocked(blocked)
                            .build()));
        }
        return listBlocked(blockerId);
    }

    /** Everyone hidden from this user, in both directions. Empty when nobody is. */
    public Set<UUID> hiddenFor(UUID userId) {
        return new HashSet<>(blockRepository.findHiddenUserIds(userId));
    }

    /** True when either of the two has blocked the other. */
    public boolean isHidden(UUID a, UUID b) {
        return blockRepository.existsBetween(a, b);
    }

    private BlockResponse toResponse(UserBlock row) {
        User blocked = row.getBlocked();
        return BlockResponse.builder()
                .userId(blocked.getId())
                .name(DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, blocked))
                .createdAt(row.getCreatedAt())
                .build();
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
