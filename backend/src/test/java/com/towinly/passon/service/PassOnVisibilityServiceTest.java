package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ConnectionStatus;
import com.towinly.common.enums.ConnectionType;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.SealedKind;
import com.towinly.common.enums.TrustLevel;
import com.towinly.connection.entity.Connection;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.family.entity.FamilyLink;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.entity.SealedItem;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * The whole mitigation for the feature's biggest risk: there is no database-level backstop
 * on who may read what an elder wrote, so every rule lives here and every rule is tested.
 *
 * Margaret owns the page. Sarah is her daughter on the family list, Tom is a helper she has
 * built trust with all the way up the ladder, Nina connected this week and nothing more, and
 * the stranger has never met her.
 */
@ExtendWith(MockitoExtension.class)
class PassOnVisibilityServiceTest {

    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock ReleaseGate releases;
    @InjectMocks PassOnVisibilityService service;

    private User margaret, sarah, tom, nina, stranger;

    @BeforeEach
    void setUp() {
        margaret = user("Margaret");
        sarah    = user("Sarah");
        tom      = user("Tom");
        nina     = user("Nina");
        stranger = user("A stranger");

        // Nobody is family and nobody is connected unless a test says so.
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(any(), any()))
                .thenReturn(Optional.empty());
        lenient().when(connectionRepository.findBetweenUsers(any(), any()))
                .thenReturn(Optional.empty());
        // And Margaret is alive. Nothing has been released unless a test says so.
        lenient().when(releases.isReleased(any())).thenReturn(false);
    }

    private User user(String name) {
        return User.builder().id(UUID.randomUUID()).fullName(name).build();
    }

    private PassOnItem story(PassOnAudience audience) {
        return PassOnItem.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .kind(PassOnKind.STORY)
                .title("The winter we lost the roof")
                .body("It snowed for four days.")
                .audience(audience)
                .releaseWhen(PassOnRelease.NOW)
                .build();
    }

    private PassOnItem letterTo(User person) {
        PassOnItem letter = story(PassOnAudience.PERSON);
        letter.setKind(PassOnKind.LETTER);
        letter.setTitle("What I wish I had told your father");
        letter.setAudienceUser(person);
        return letter;
    }

    // Lenient on purpose: several tests set a link or a friendship up precisely to prove the
    // service does not consult it, and assert that with verify(never()) instead.
    private void familyLink(User elder, User familyUser, FamilyLinkStatus status) {
        lenient().when(familyLinkRepository.findByElderIdAndFamilyUserId(elder.getId(), familyUser.getId()))
                .thenReturn(Optional.of(FamilyLink.builder()
                        .id(UUID.randomUUID())
                        .elder(elder)
                        .familyUser(familyUser)
                        .initiatedBy(familyUser)
                        .status(status)
                        .build()));
    }

    private Connection friendship(User a, User b, ConnectionStatus status, TrustLevel level) {
        return Connection.builder()
                .id(UUID.randomUUID())
                .userA(a).userB(b)
                .type(ConnectionType.SOCIAL)
                .status(status)
                .currentTrustLevel(level)
                .initiatedBy(b)
                .build();
    }

    private void friendshipBetween(User a, User b, Connection connection) {
        lenient().when(connectionRepository.findBetweenUsers(a.getId(), b.getId()))
                .thenReturn(Optional.of(connection));
    }

    /** A letter she wrote to be read after she is gone. */
    private PassOnItem heldUntilAfter(User person) {
        PassOnItem letter = letterTo(person);
        letter.setReleaseWhen(PassOnRelease.AFTER);
        return letter;
    }

    /** A person has run the release procedure by hand for this owner. */
    private void released(User owner) {
        lenient().when(releases.isReleased(owner.getId())).thenReturn(true);
    }

    // ── the four audiences ──

    @Test
    void everyoneIsReadableByAStranger() {
        assertThat(service.canRead(story(PassOnAudience.EVERYONE), stranger.getId())).isTrue();
    }

    @Test
    void familyIsReadableByAnActiveFamilyLink() {
        familyLink(margaret, sarah, FamilyLinkStatus.ACTIVE);

        assertThat(service.canRead(story(PassOnAudience.FAMILY), sarah.getId())).isTrue();
    }

    @Test
    void familyIsNotReadableByAnEndedFamilyLink() {
        familyLink(margaret, sarah, FamilyLinkStatus.REVOKED);

        assertThat(service.canRead(story(PassOnAudience.FAMILY), sarah.getId())).isFalse();
    }

    @Test
    void familyIsNotReadableByATrustedHelper() {
        friendshipBetween(margaret, tom, friendship(margaret, tom, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED));

        assertThat(service.canRead(story(PassOnAudience.FAMILY), tom.getId())).isFalse();
        // Trust on the helper ladder is not a route into "my family" — never even looked at.
        verify(connectionRepository, never()).findBetweenUsers(any(), any());
    }

    @Test
    void helpersIsReadableByATrustedStageConnection() {
        friendshipBetween(margaret, tom, friendship(margaret, tom, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED));

        assertThat(service.canRead(story(PassOnAudience.HELPERS), tom.getId())).isTrue();
    }

    @Test
    void helpersIsNotReadableByAConnectionAcceptedYesterday() {
        // Accepted, and nothing more: still on the first rung of the ladder.
        friendshipBetween(margaret, nina, friendship(margaret, nina, ConnectionStatus.ACTIVE, TrustLevel.DISCOVERED));

        assertThat(service.canRead(story(PassOnAudience.HELPERS), nina.getId())).isFalse();
    }

    @Test
    void helpersIsNotReadablePartWayUpTheLadder() {
        // "Ready to Meet" is a long way from a stranger and still not far enough: the audience
        // is the helpers she has built up trust with, which is the top rung and nothing less.
        // This is the test that pins the threshold — the one above passes at any threshold.
        friendshipBetween(margaret, nina, friendship(margaret, nina, ConnectionStatus.ACTIVE, TrustLevel.FIRST_MEET));

        assertThat(service.canRead(story(PassOnAudience.HELPERS), nina.getId())).isFalse();
    }

    @Test
    void helpersIsNotReadableThroughAnEndedFriendship() {
        Connection ended = friendship(margaret, tom, ConnectionStatus.ENDED, TrustLevel.TRUSTED);
        friendshipBetween(margaret, tom, ended);

        assertThat(service.canRead(story(PassOnAudience.HELPERS), tom.getId())).isFalse();
    }

    @Test
    void helpersIsNotReadableThroughAFamilyCoordinationChat() {
        // A FAMILY-type row is a coordination chat, not a trust journey — it never earns a read.
        Connection coordination = friendship(margaret, sarah, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED);
        coordination.setType(ConnectionType.FAMILY);
        friendshipBetween(margaret, sarah, coordination);

        assertThat(service.canRead(story(PassOnAudience.HELPERS), sarah.getId())).isFalse();
    }

    @Test
    void personIsReadableOnlyByThatPerson() {
        PassOnItem letter = letterTo(sarah);
        familyLink(margaret, tom, FamilyLinkStatus.ACTIVE);

        assertThat(service.canRead(letter, sarah.getId())).isTrue();
        assertThat(service.canRead(letter, tom.getId())).isFalse();
        assertThat(service.canRead(letter, stranger.getId())).isFalse();
        // Tom is on her family list, and it makes no difference: a letter is one person only.
        verify(familyLinkRepository, never()).findByElderIdAndFamilyUserId(any(), any());
    }

    @Test
    void aLetterWhoseNamedPersonClosedTheirAccountIsReadableByNobody() {
        // audience_user_id goes null on ON DELETE SET NULL — it must never widen to everyone.
        PassOnItem orphaned = letterTo(sarah);
        orphaned.setAudienceUser(null);

        assertThat(service.canRead(orphaned, sarah.getId())).isFalse();
        assertThat(service.canRead(orphaned, stranger.getId())).isFalse();
    }

    // ── the Sealed box ──

    @Test
    void sealedItemsAreNeverReadableByAnyone() {
        SealedItem sealed = SealedItem.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .labelCipher(new byte[]{1}).labelIv(new byte[]{2})
                .bodyCipher(new byte[]{3}).bodyIv(new byte[]{4})
                .wrappedKey(new byte[]{5})
                .kindHint(SealedKind.MONEY)
                .byteSize(1)
                .build();
        familyLink(margaret, sarah, FamilyLinkStatus.ACTIVE);

        assertThat(service.canRead(sealed, margaret.getId())).isFalse();
        assertThat(service.canRead(sealed, sarah.getId())).isFalse();
        assertThat(service.canRead(sealed, stranger.getId())).isFalse();
        // Not even the owner, and no lookup that could ever turn into a yes.
        verify(familyLinkRepository, never()).findByElderIdAndFamilyUserId(any(), any());
        verify(connectionRepository, never()).findBetweenUsers(any(), any());
    }

    // ── the owner, and the states nothing may leak through ──

    @Test
    void theOwnerAlwaysReadsHerOwnWriting() {
        assertThat(service.canRead(story(PassOnAudience.FAMILY), margaret.getId())).isTrue();
        assertThat(service.canRead(story(PassOnAudience.HELPERS), margaret.getId())).isTrue();
        assertThat(service.canRead(letterTo(sarah), margaret.getId())).isTrue();
    }

    // ── "after I am gone", and the one thing that opens it ──

    @Test
    void aLetterHeldUntilAfterStaysShutWhileNobodyHasReleasedIt() {
        // The whole point of the feature: Sarah is the person it is addressed to, and she still
        // cannot see it — not the words, not the title, not that it exists. Margaret can, because
        // it is hers.
        PassOnItem letter = heldUntilAfter(sarah);

        assertThat(service.canRead(letter, sarah.getId())).isFalse();
        assertThat(service.canRead(letter, margaret.getId())).isTrue();
    }

    @Test
    void aLetterHeldUntilAfterOpensForItsPersonOnceSomebodyHasReleasedIt() {
        // A person read a death certificate, asked each Keyholder separately, waited thirty days
        // and set released_at by hand. That, and only that, is what has changed here.
        released(margaret);
        PassOnItem letter = heldUntilAfter(sarah);

        assertThat(service.canRead(letter, sarah.getId())).isTrue();
    }

    @Test
    void aLetterHeldUntilAfterIsNeverReadableByAnybodyButItsPerson() {
        // Release is not a general unlocking of her page. It opens each letter to the one person
        // it names and to nobody else — her family, her most trusted helper, a stranger, all no.
        released(margaret);
        familyLink(margaret, tom, FamilyLinkStatus.ACTIVE);
        friendshipBetween(margaret, tom, friendship(margaret, tom, ConnectionStatus.ACTIVE, TrustLevel.TRUSTED));
        PassOnItem letter = heldUntilAfter(sarah);

        assertThat(service.canRead(letter, tom.getId())).isFalse();
        assertThat(service.canRead(letter, nina.getId())).isFalse();
        assertThat(service.canRead(letter, stranger.getId())).isFalse();
    }

    @Test
    void aLetterHeldUntilAfterIsShutToEverybodyElseBeforeAReleaseToo() {
        PassOnItem letter = heldUntilAfter(sarah);

        assertThat(service.canRead(letter, tom.getId())).isFalse();
        assertThat(service.canRead(letter, stranger.getId())).isFalse();
    }

    @Test
    void nobodyReadsAnythingWithoutASignedInReader() {
        assertThat(service.canRead(story(PassOnAudience.EVERYONE), null)).isFalse();
    }
}
