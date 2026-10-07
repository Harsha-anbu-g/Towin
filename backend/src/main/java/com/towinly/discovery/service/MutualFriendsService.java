package com.towinly.discovery.service;

import com.towinly.block.service.BlockService;
import com.towinly.common.entity.User;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.discovery.dto.MutualFriendResponse;
import com.towinly.discovery.dto.MutualFriendResponse.Relation;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * "You both know" for the Add Friends suggestions.
 *
 * For each suggested person it finds who in the viewer's own circle links the two:
 * family first ("Sarah, your daughter"), then shared friends, then friends of
 * friends ("through Tom": Tom knows someone this person knows). Only people the
 * viewer already knows are ever named; the person in the middle of a "through"
 * link stays unnamed. Anyone hidden by a block or the demo wall is left out on
 * both sides.
 *
 * Built from four reads for the whole page, never one lookup per card.
 */
@Service
@RequiredArgsConstructor
public class MutualFriendsService {

    /** How many names a card shows; the count says how many there are in all. */
    static final int SHOWN = 3;

    private final ConnectionRepository connectionRepository;
    private final FamilyLinkRepository familyLinkRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final BlockService blockService;

    public record Mutuals(List<MutualFriendResponse> shown, int count) {
        public static final Mutuals NONE = new Mutuals(List.of(), 0);
    }

    @Transactional(readOnly = true)
    public Map<UUID, Mutuals> forCandidates(UUID viewerId, Collection<UUID> candidateIds, Set<UUID> hiddenForViewer) {
        Set<UUID> candidates = new HashSet<>(candidateIds);
        candidates.remove(viewerId);
        if (candidates.isEmpty()) return Map.of();

        // The viewer's circle: everyone they are actively connected to, plus the
        // family members linked to them. Family is remembered with its own word.
        Map<UUID, User> circle = new LinkedHashMap<>();
        Map<UUID, String> family = new HashMap<>();
        for (FamilyLink link : familyLinkRepository.findByElderIdAndStatus(viewerId, FamilyLinkStatus.ACTIVE)) {
            User member = link.getFamilyUser();
            if (member == null || hiddenForViewer.contains(member.getId())) continue;
            circle.put(member.getId(), member);
            family.put(member.getId(), link.getRelationship());
        }
        for (Connection c : connectionRepository.findByUserAndStatus(viewerId, ConnectionStatus.ACTIVE)) {
            User other = c.getOtherUser(viewerId);
            if (other == null || hiddenForViewer.contains(other.getId())) continue;
            circle.putIfAbsent(other.getId(), other);
        }
        if (circle.isEmpty()) return Map.of();

        // Who each suggested person knows: their active connections, and for an
        // elder, the family members linked to them.
        Map<UUID, Set<UUID>> theirPeople = neighbours(candidates);
        for (FamilyLink link : familyLinkRepository.findByElderIdInAndStatus(candidates, FamilyLinkStatus.ACTIVE)) {
            if (link.getFamilyUser() == null) continue;
            theirPeople.computeIfAbsent(link.getElder().getId(), k -> new HashSet<>()).add(link.getFamilyUser().getId());
        }
        // Who each person in the viewer's circle knows, for the "through" links.
        Map<UUID, Set<UUID>> circlePeople = neighbours(circle.keySet());

        Map<UUID, String> names = new HashMap<>();
        Map<UUID, Mutuals> result = new HashMap<>();
        for (UUID candidate : candidates) {
            Set<UUID> known = theirPeople.getOrDefault(candidate, Set.of());

            List<UUID> familyMutuals = new ArrayList<>();
            List<UUID> friendMutuals = new ArrayList<>();
            for (UUID m : circle.keySet()) {
                if (m.equals(candidate) || !known.contains(m)) continue;
                (family.containsKey(m) ? familyMutuals : friendMutuals).add(m);
            }
            List<UUID> through = new ArrayList<>();
            for (UUID x : circle.keySet()) {
                if (x.equals(candidate) || known.contains(x)) continue;
                boolean linked = circlePeople.getOrDefault(x, Set.of()).stream().anyMatch(y ->
                        !y.equals(viewerId) && !y.equals(candidate)
                                && !hiddenForViewer.contains(y) && known.contains(y));
                if (linked) through.add(x);
            }
            if (familyMutuals.isEmpty() && friendMutuals.isEmpty() && through.isEmpty()) continue;

            // A link through someone this person blocked (or who blocked them) is not a link.
            Set<UUID> hiddenForCandidate = blockService.hiddenFor(candidate);
            familyMutuals.removeIf(hiddenForCandidate::contains);
            friendMutuals.removeIf(hiddenForCandidate::contains);
            through.removeIf(hiddenForCandidate::contains);

            List<MutualFriendResponse> shown = new ArrayList<>();
            for (UUID m : familyMutuals) add(shown, circle.get(m), Relation.FAMILY, family.get(m), names);
            for (UUID m : friendMutuals) add(shown, circle.get(m), Relation.FRIEND, null, names);
            for (UUID x : through) add(shown, circle.get(x), Relation.THROUGH, null, names);
            if (shown.isEmpty()) continue;

            result.put(candidate, new Mutuals(shown, familyMutuals.size() + friendMutuals.size()));
        }
        return result;
    }

    private void add(List<MutualFriendResponse> shown, User person, Relation relation, String relationship,
                     Map<UUID, String> names) {
        if (shown.size() >= SHOWN || person == null) return;
        String name = names.computeIfAbsent(person.getId(),
                id -> DisplayNameResolver.resolve(elderProfileRepository, helperProfileRepository, person));
        shown.add(MutualFriendResponse.builder()
                .userId(person.getId())
                .name(name)
                .relation(relation)
                .relationship(relationship)
                .build());
    }

    /** Person → everyone they are actively connected to, for a whole set in one read. */
    private Map<UUID, Set<UUID>> neighbours(Set<UUID> people) {
        Map<UUID, Set<UUID>> out = new HashMap<>();
        if (people.isEmpty()) return out;
        for (Connection c : connectionRepository.findByStatusTouchingAny(people, ConnectionStatus.ACTIVE)) {
            UUID a = c.getUserA().getId();
            UUID b = c.getUserB().getId();
            if (people.contains(a)) out.computeIfAbsent(a, k -> new HashSet<>()).add(b);
            if (people.contains(b)) out.computeIfAbsent(b, k -> new HashSet<>()).add(a);
        }
        return out;
    }
}
