package com.towinly.passon.service;

import com.towinly.block.repository.UserBlockRepository;
import com.towinly.block.service.BlockService;
import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.repository.UserRepository;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.dto.PassOnFromResponse;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The block gate proven end to end, above the read receipt. {@code PassOnService.from} runs
 * every item through the real {@link PassOnVisibilityService}, and only stamps "read on this
 * day" onto a letter once that authority has said yes. So a block must not merely hide the
 * words: it must land above the stamp, or a blocked reader would leave a footprint on the
 * most private thing in the product on their way to being refused.
 *
 * Everything is wired for real here — a real {@link BlockService} over a mocked block table,
 * a real visibility authority, a real service — so nothing but the persistence is faked and
 * the gate is exercised exactly as production runs it.
 *
 * Margaret wrote a letter to Tom by name. Tom is the one person it is addressed to.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PassOnReadReceiptBlockTest {

    @Mock PassOnItemRepository items;
    @Mock UserRepository users;
    @Mock ElderProfileRepository elderProfiles;
    @Mock HelperProfileRepository helperProfiles;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock ReleaseGate releases;
    @Mock UserBlockRepository blockRepository;

    private PassOnService service;
    private User margaret, tom;
    private PassOnItem letter;

    @BeforeEach
    void setUp() {
        margaret = user("Margaret");
        tom = user("Tom");

        BlockService blocks = new BlockService(blockRepository, users, elderProfiles, helperProfiles);
        PassOnVisibilityService visibility =
                new PassOnVisibilityService(familyLinkRepository, connectionRepository, releases, blocks);
        service = new PassOnService(items, users, elderProfiles, helperProfiles, visibility, releases);

        letter = PassOnItem.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .kind(PassOnKind.LETTER)
                .title("What I wish I had told your father")
                .body("Everything, in the end.")
                .audience(PassOnAudience.PERSON)
                .audienceUser(tom)
                .releaseWhen(PassOnRelease.NOW)
                .build();

        when(users.findById(margaret.getId())).thenReturn(Optional.of(margaret));
        when(items.findByOwnerIdOrderByCreatedAtDesc(margaret.getId())).thenReturn(List.of(letter));
        when(releases.isReleased(margaret.getId())).thenReturn(false);
        when(elderProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(helperProfiles.findByUserId(any())).thenReturn(Optional.empty());
        when(items.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    private User user(String name) {
        return User.builder().id(UUID.randomUUID()).fullName(name).build();
    }

    @Test
    void theNamedPersonReadsHerLetterAndTheDayIsStamped() {
        // No block. Tom is the person it names, so he reads it and the first-read day is
        // written down once — the ordinary delivery this feature exists to record.
        when(blockRepository.existsBetween(margaret.getId(), tom.getId())).thenReturn(false);

        PassOnFromResponse page = service.from(tom.getId(), margaret.getId());

        assertThat(page.getItems()).extracting(i -> i.getId()).containsExactly(letter.getId());
        assertThat(letter.getFirstReadAt()).isNotNull();
        verify(items).save(letter);
    }

    @Test
    void aBlockedReaderIsRefusedTheLetterAndNoReceiptIsWritten() {
        // A block stands between them. Tom is still the named person, but the gate sits above
        // both the audience and the stamp: he reads nothing, and no footprint is left behind.
        when(blockRepository.existsBetween(margaret.getId(), tom.getId())).thenReturn(true);

        PassOnFromResponse page = service.from(tom.getId(), margaret.getId());

        assertThat(page.getItems()).isEmpty();
        assertThat(letter.getFirstReadAt()).isNull();
        verify(items, never()).save(any());
    }
}
