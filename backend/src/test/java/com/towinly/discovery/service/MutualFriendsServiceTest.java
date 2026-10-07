package com.towinly.discovery.service;

import com.towinly.block.service.BlockService;
import com.towinly.common.entity.User;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.UserRole;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.discovery.dto.MutualFriendResponse;
import com.towinly.discovery.dto.MutualFriendResponse.Relation;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MutualFriendsServiceTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock BlockService blockService;

    MutualFriendsService service;

    // Margaret (the viewer, an elder) and the people around her.
    User margaret = user("Margaret", UserRole.ELDER);
    User sarah = user("Sarah", UserRole.FAMILY);      // Margaret's daughter
    User grace = user("Grace", UserRole.ELDER);       // Margaret's elder friend
    User tom = user("Tom", UserRole.HELPER);          // Margaret's helper
    User rose = user("Rose", UserRole.ELDER);         // knows Tom, not Margaret
    User harsha = user("Harsha", UserRole.HELPER);    // the suggested helper

    List<Connection> active = new ArrayList<>();
    List<FamilyLink> links = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new MutualFriendsService(connectionRepository, familyLinkRepository,
                elderProfileRepository, helperProfileRepository, blockService);
        when(blockService.hiddenFor(any())).thenReturn(Set.of());
        when(familyLinkRepository.findByElderIdAndStatus(any(), eq(FamilyLinkStatus.ACTIVE)))
                .thenAnswer(inv -> links.stream().filter(l -> l.getElder().getId().equals(inv.getArgument(0))).toList());
        when(familyLinkRepository.findByElderIdInAndStatus(anyCollection(), eq(FamilyLinkStatus.ACTIVE)))
                .thenAnswer(inv -> {
                    Collection<UUID> ids = inv.getArgument(0);
                    return links.stream().filter(l -> ids.contains(l.getElder().getId())).toList();
                });
        when(connectionRepository.findByUserAndStatus(any(), eq(ConnectionStatus.ACTIVE)))
                .thenAnswer(inv -> active.stream().filter(c -> c.isParticipant(inv.getArgument(0))).toList());
        when(connectionRepository.findByStatusTouchingAny(anyCollection(), eq(ConnectionStatus.ACTIVE)))
                .thenAnswer(inv -> {
                    Collection<UUID> ids = inv.getArgument(0);
                    return active.stream().filter(c -> ids.contains(c.getUserA().getId())
                            || ids.contains(c.getUserB().getId())).toList();
                });
    }

    @Test
    void familyComesFirstWithItsOwnWord() {
        link(margaret, sarah, "daughter");
        connect(sarah, harsha, ConnectionType.FAMILY);
        connect(margaret, grace, ConnectionType.PEER);
        connect(grace, harsha, ConnectionType.PEER);

        MutualFriendsService.Mutuals m = forHarsha();

        assertThat(m.shown()).extracting(MutualFriendResponse::getName).containsExactly("Sarah", "Grace");
        assertThat(m.shown().get(0).getRelation()).isEqualTo(Relation.FAMILY);
        assertThat(m.shown().get(0).getRelationship()).isEqualTo("daughter");
        assertThat(m.shown().get(1).getRelation()).isEqualTo(Relation.FRIEND);
        assertThat(m.count()).isEqualTo(2);
    }

    @Test
    void aFriendOfAFriendIsShownThroughTheFriendAndThePersonBetweenStaysUnnamed() {
        connect(margaret, tom, ConnectionType.SOCIAL);
        connect(tom, rose, ConnectionType.SOCIAL);
        connect(rose, harsha, ConnectionType.SOCIAL);

        MutualFriendsService.Mutuals m = forHarsha();

        assertThat(m.shown()).hasSize(1);
        assertThat(m.shown().get(0).getName()).isEqualTo("Tom");
        assertThat(m.shown().get(0).getRelation()).isEqualTo(Relation.THROUGH);
        assertThat(m.shown()).extracting(MutualFriendResponse::getName).doesNotContain("Rose");
        assertThat(m.count()).isZero();
    }

    @Test
    void theViewerIsNeverTheLinkInTheMiddle() {
        // Tom and Harsha both know Margaret herself: that is not a mutual friend.
        connect(margaret, tom, ConnectionType.SOCIAL);
        connect(margaret, harsha, ConnectionType.SOCIAL);

        assertThat(service.forCandidates(margaret.getId(), List.of(harsha.getId()), Set.of())).isEmpty();
    }

    @Test
    void someoneTheSuggestedPersonBlockedIsNotALink() {
        connect(margaret, grace, ConnectionType.PEER);
        connect(grace, harsha, ConnectionType.PEER);
        when(blockService.hiddenFor(harsha.getId())).thenReturn(Set.of(grace.getId()));

        assertThat(service.forCandidates(margaret.getId(), List.of(harsha.getId()), Set.of())).isEmpty();
    }

    @Test
    void someoneTheViewerBlockedIsNeverNamed() {
        connect(margaret, grace, ConnectionType.PEER);
        connect(grace, harsha, ConnectionType.PEER);

        assertThat(service.forCandidates(margaret.getId(), List.of(harsha.getId()), Set.of(grace.getId()))).isEmpty();
    }

    @Test
    void atMostThreeNamesButTheCountIsTheWholeNumber() {
        for (int i = 0; i < 5; i++) {
            User friend = user("Friend" + i, UserRole.ELDER);
            connect(margaret, friend, ConnectionType.PEER);
            connect(friend, harsha, ConnectionType.SOCIAL);
        }

        MutualFriendsService.Mutuals m = forHarsha();

        assertThat(m.shown()).hasSize(3);
        assertThat(m.count()).isEqualTo(5);
    }

    @Test
    void noCircleMeansNoFurtherReads() {
        Map<UUID, MutualFriendsService.Mutuals> result =
                service.forCandidates(margaret.getId(), List.of(harsha.getId()), Set.of());

        assertThat(result).isEmpty();
        verify(connectionRepository, never()).findByStatusTouchingAny(anyCollection(), any());
    }

    private MutualFriendsService.Mutuals forHarsha() {
        return service.forCandidates(margaret.getId(), List.of(harsha.getId()), Set.of()).get(harsha.getId());
    }

    private void connect(User a, User b, ConnectionType type) {
        active.add(Connection.builder().id(UUID.randomUUID()).userA(a).userB(b)
                .type(type).status(ConnectionStatus.ACTIVE).build());
    }

    private void link(User elder, User member, String relationship) {
        links.add(FamilyLink.builder().id(UUID.randomUUID()).elder(elder).familyUser(member)
                .relationship(relationship).status(FamilyLinkStatus.ACTIVE).build());
    }

    private static User user(String name, UserRole role) {
        return User.builder().id(UUID.randomUUID()).fullName(name).username(name.toLowerCase()).role(role).build();
    }
}
