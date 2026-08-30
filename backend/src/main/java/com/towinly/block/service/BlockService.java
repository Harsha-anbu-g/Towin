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
import org.springframework.cache.annotation.CacheEvict;
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

    /**
     * What a write path says when a block stands between two people. Deliberately the
     * same shape and tone as the other 409s the composer already understands, and
     * deliberately silent about the reason: the blocked person must never learn it.
     */
    public static final String CHAT_CLOSED = "This chat is closed right now.";
    public static final String NOT_AVAILABLE = "This isn't available right now.";

    private final UserBlockRepository blockRepository;
    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;

    /**
     * Hides {@code blockedId} from {@code blockerId} and the other way round. Idempotent.
     * Discovery answers are cached for five minutes; a block must not wait that long
     * (trust-and-safety rule: gone from the other party's surfaces immediately).
     */
    @Transactional
    @CacheEvict(cacheNames = {"discovery-elders", "discovery-helpers"}, allEntries = true)
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
    @CacheEvict(cacheNames = {"discovery-elders", "discovery-helpers"}, allEntries = true)
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
    @CacheEvict(cacheNames = {"discovery-elders", "discovery-helpers"}, allEntries = true)
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

    /**
     * Everyone this user chose to block. Use this, not {@link #hiddenFor}, wherever the answer
     * should depend on WHO cut contact: a person's own choice may take something off their screen,
     * but somebody else's choice must never take away a third party's view. Blocking a family
     * member cannot be allowed to switch off their oversight of the parent they watch over.
     */
    public Set<UUID> blockedBy(UUID userId) {
        return new HashSet<>(blockRepository.findBlockedByUserIds(userId));
    }

    /** Everyone who blocked this user. The other direction of {@link #blockedBy}. */
    public Set<UUID> blockersOf(UUID userId) {
        return new HashSet<>(blockRepository.findBlockersOfUserIds(userId));
    }

    /** True when {@code actor} chose to block {@code subject}. Directional, unlike {@link #isHidden}. */
    public boolean hasBlocked(UUID actor, UUID subject) {
        return blockRepository.findByBlockerIdAndBlockedId(actor, subject).isPresent();
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
