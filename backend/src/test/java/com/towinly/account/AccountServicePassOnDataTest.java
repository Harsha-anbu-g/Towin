package com.towinly.account;

import com.towinly.common.entity.User;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.SealedKind;
import com.towinly.common.enums.UserRole;
import com.towinly.common.repository.UserRepository;
import com.towinly.notification.repository.PushTokenRepository;
import com.towinly.common.service.S3Service;
import com.towinly.connection.repository.ConnectionRepository;
import com.towinly.emergency.repository.EmergencyContactRepository;
import com.towinly.family.repository.FamilyAlertRepository;
import com.towinly.family.repository.FamilyDelegatedPowerRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import com.towinly.family.repository.FamilyPowerRequestRepository;
import com.towinly.messaging.repository.MessageRepository;
import com.towinly.need.repository.NeedApplicationRepository;
import com.towinly.need.repository.NeedRepository;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.entity.PassOnOpen;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.profile.repository.ElderProfileRepository;
import com.towinly.profile.repository.HelperProfileRepository;
import com.towinly.report.repository.ReportRepository;
import com.towinly.review.repository.ReviewRepository;
import com.towinly.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

/**
 * "What I pass on" inside the two account-wide operations: the right-to-erasure purge and
 * the GDPR export.
 *
 * Three things are being held in place here, and each of them is a way the feature could
 * quietly become unsafe.
 *
 * <b>Everything leaves with the account.</b> Four of the five tables would cascade off the
 * user row on their own, but {@code passon_opens.owner_id} deliberately carries no foreign
 * key — see V53 — so those rows outlive the account unless the purge names them. The purge
 * stays the single source of truth for what leaves, exactly as it already does for the
 * family tables.
 *
 * <b>The export is not a second door into the Sealed box.</b> {@code GET /api/account/export}
 * is authenticated by the JWT alone; it never asks for the password and it is not subject to
 * the seven-day freeze after a credential change. If it returned anything readable from the
 * box, whoever takes over an elder's mailbox would be one download away from her bank
 * details, and both defences would be decorative.
 *
 * <b>The delete confirmation says what would be lost.</b> The same counts serve the
 * self-serve and the admin path, because {@code purgeUserData} is shared and an admin
 * pressing Delete would otherwise destroy a Sealed box with no warning at all.
 */
class AccountServicePassOnDataTest {

    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock ReportRepository reportRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock NeedRepository needRepository;
    @Mock NeedApplicationRepository needApplicationRepository;
    @Mock MessageRepository messageRepository;
    @Mock EmergencyContactRepository emergencyContactRepository;
    @Mock TrustProgressionLogRepository trustProgressionLogRepository;
    @Mock FamilyLinkRepository familyLinkRepository;
    @Mock FamilyAlertRepository familyAlertRepository;
    @Mock FamilyDelegatedPowerRepository familyDelegatedPowerRepository;
    @Mock FamilyPowerRequestRepository familyPowerRequestRepository;
    @Mock PassOnItemRepository passOnItemRepository;
    @Mock SealedItemRepository sealedItemRepository;
    @Mock KeyholderRepository keyholderRepository;
    @Mock PassOnSettingsRepository passOnSettingsRepository;
    @Mock PassOnOpenRepository passOnOpenRepository;
    @Mock com.towinly.passon.service.ReleaseGate releaseGate;
    @Mock com.towinly.passon.service.ReleaseContact releaseContact;
    @Mock S3Service s3Service;

    @Mock PushTokenRepository pushTokenRepository;
    @InjectMocks AccountService accountService;

    UUID margaretId = UUID.randomUUID();
    UUID sarahId = UUID.randomUUID();
    User margaret;
    User sarah;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        margaret = User.builder()
                .id(margaretId).email("margaret@test.com").username("margaret")
                .role(UserRole.ELDER).build();
        sarah = User.builder()
                .id(sarahId).email("sarah@test.com").username("sarah")
                .role(UserRole.FAMILY).build();
        when(userRepository.findById(margaretId)).thenReturn(Optional.of(margaret));
        when(needRepository.findByElderIdOrderByCreatedAtDesc(any(UUID.class), any(Pageable.class)))
                .thenReturn(Page.empty());
    }

    // ── purge ────────────────────────────────────────────────────────────────

    @Test
    void purgeRemovesAllFivePassOnTablesBeforeTheUserRow() {
        accountService.purgeUserData(margaretId);

        InOrder order = inOrder(passOnOpenRepository, keyholderRepository, sealedItemRepository,
                passOnSettingsRepository, passOnItemRepository, userRepository);
        order.verify(passOnOpenRepository).deleteByOwnerId(margaretId);
        order.verify(keyholderRepository).deleteByOwnerIdOrKeyholderId(margaretId, margaretId);
        order.verify(sealedItemRepository).deleteByOwnerId(margaretId);
        order.verify(passOnSettingsRepository).deleteByOwnerId(margaretId);
        order.verify(passOnItemRepository).deleteByOwnerId(margaretId);
        order.verify(userRepository).delete(margaret);
    }

    @Test
    void purgeRemovesKeysHeldForOtherPeopleTooNotJustTheOwnSealedBox() {
        // Sarah owns no box, but she holds a key to Margaret's. Deleting Sarah has to take
        // that row with her, or Margaret's threshold silently counts a person who is gone.
        when(userRepository.findById(sarahId)).thenReturn(Optional.of(sarah));

        accountService.purgeUserData(sarahId);

        // Both sides in one call — the departing user may sit on either.
        org.mockito.Mockito.verify(keyholderRepository).deleteByOwnerIdOrKeyholderId(sarahId, sarahId);
    }

    // ── export ───────────────────────────────────────────────────────────────

    @Test
    void exportEmitsSealedKindAndSizeButNeverTheLabelOrTheBody() {
        // The plan called this "emits label and kind"; there is no plaintext label to emit.
        // V51 deliberately stores the label encrypted, because a readable "Where the cash is
        // hidden" beside the ciphertext, attached to a named elderly person at a known
        // address, is a burglary list. Decrypting it for the export would put it back.
        when(sealedItemRepository.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(margaretId))
                .thenReturn(List.of(sealedItem(SealedKind.MONEY, 412)));

        Map<String, Object> export = accountService.exportUserData(margaretId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> box = (List<Map<String, Object>>) export.get("sealedBoxItems");
        assertThat(box).hasSize(1);
        assertThat(box.get(0).get("kind")).isEqualTo("MONEY");
        assertThat(box.get(0).get("byteSize")).isEqualTo(412);
        assertThat(box.get(0)).doesNotContainKeys(
                "label", "labelCipher", "labelIv", "body", "bodyCipher", "bodyIv", "wrappedKey");
        // Nothing anywhere in the export may carry the ciphertext either — a base64 blob in
        // a downloadable file is still the box leaving the building.
        assertThat(export.toString()).doesNotContain("Where the cash is");
    }

    @Test
    void exportIncludesHerOwnStoriesAndLettersInFull() {
        when(passOnItemRepository.findByOwnerIdOrderByCreatedAtDesc(margaretId))
                .thenReturn(List.of(story(), letterTo(sarah)));

        Map<String, Object> export = accountService.exportUserData(margaretId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) export.get("passOnItems");
        assertThat(items).hasSize(2);
        assertThat(items.get(0).get("kind")).isEqualTo("STORY");
        assertThat(items.get(0).get("title")).isEqualTo("The winter we moved");
        assertThat(items.get(0).get("body")).isEqualTo("It snowed for a week and we had no coal.");
        assertThat(items.get(0).get("audience")).isEqualTo("EVERYONE");
        assertThat(items.get(1).get("kind")).isEqualTo("LETTER");
        assertThat(items.get(1).get("audienceUserId")).isEqualTo(sarahId);
    }

    @Test
    void exportIncludesKeyholdersSettingsAndTheRecordOfEveryOpen() {
        when(keyholderRepository.findByOwnerIdOrKeyholderId(margaretId, margaretId))
                .thenReturn(List.of(keyholder(KeyholderStatus.ACTIVE)));
        when(passOnSettingsRepository.findById(margaretId)).thenReturn(Optional.of(settings()));
        when(passOnOpenRepository.findByOwnerIdOrderByAtDesc(margaretId))
                .thenReturn(List.of(open()));

        Map<String, Object> export = accountService.exportUserData(margaretId);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> keys = (List<Map<String, Object>>) export.get("sealedBoxKeyholders");
        assertThat(keys).hasSize(1);
        assertThat(keys.get(0).get("status")).isEqualTo("ACTIVE");
        assertThat(keys.get(0).get("keyholderId")).isEqualTo(sarahId);

        @SuppressWarnings("unchecked")
        Map<String, Object> box = (Map<String, Object>) export.get("sealedBoxSettings");
        assertThat(box.get("approvalsNeeded")).isEqualTo((short) 2);
        assertThat(box.get("keyholderTarget")).isEqualTo((short) 3);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> opens = (List<Map<String, Object>>) export.get("sealedBoxOpens");
        assertThat(opens).hasSize(1);
        assertThat(opens.get(0).get("kind")).isEqualTo("OPENED_BY_OWNER");
        assertThat(opens.get(0).get("actorLabel")).isEqualTo("Margaret");
    }

    @Test
    void exportOmitsTheSettingsSectionEntirelyWhenSheHasNoSealedBox() {
        Map<String, Object> export = accountService.exportUserData(margaretId);

        assertThat(export).doesNotContainKey("sealedBoxSettings");
        assertThat((List<?>) export.get("passOnItems")).isEmpty();
        assertThat((List<?>) export.get("sealedBoxItems")).isEmpty();
        assertThat((List<?>) export.get("sealedBoxKeyholders")).isEmpty();
        assertThat((List<?>) export.get("sealedBoxOpens")).isEmpty();
    }

    // ── the delete confirmation ──────────────────────────────────────────────

    @Test
    void deletionWarningCountsEveryKindOfThingThatWouldBeLost() {
        when(passOnItemRepository.countByOwnerIdAndKind(margaretId, PassOnKind.STORY)).thenReturn(3L);
        when(passOnItemRepository.countByOwnerIdAndKind(margaretId, PassOnKind.LETTER)).thenReturn(2L);
        when(sealedItemRepository.countByOwnerId(margaretId)).thenReturn(4L);
        when(keyholderRepository.countByOwnerIdAndStatus(margaretId, KeyholderStatus.ACTIVE)).thenReturn(2L);

        Map<String, Object> warning = accountService.deletionWarning(margaretId);

        assertThat(warning.get("stories")).isEqualTo(3L);
        assertThat(warning.get("letters")).isEqualTo(2L);
        assertThat(warning.get("sealedItems")).isEqualTo(4L);
        assertThat(warning.get("keyholders")).isEqualTo(2L);
        assertThat((String) warning.get("summary"))
                .isEqualTo("Deleting this account also deletes 3 stories, 2 letters and 4 things "
                        + "in a Sealed box. None of it can be brought back.");
        assertThat(warning.get("keyholderNote"))
                .isEqualTo("2 people hold a key to that Sealed box. Nobody is told when it goes.");
    }

    @Test
    void deletionWarningUsesSingularWordsForOneOfEachThing() {
        when(passOnItemRepository.countByOwnerIdAndKind(margaretId, PassOnKind.STORY)).thenReturn(1L);
        when(passOnItemRepository.countByOwnerIdAndKind(margaretId, PassOnKind.LETTER)).thenReturn(1L);
        when(sealedItemRepository.countByOwnerId(margaretId)).thenReturn(1L);
        when(keyholderRepository.countByOwnerIdAndStatus(margaretId, KeyholderStatus.ACTIVE)).thenReturn(1L);

        Map<String, Object> warning = accountService.deletionWarning(margaretId);

        assertThat((String) warning.get("summary"))
                .isEqualTo("Deleting this account also deletes 1 story, 1 letter and 1 thing "
                        + "in a Sealed box. None of it can be brought back.");
        assertThat(warning.get("keyholderNote"))
                .isEqualTo("1 person holds a key to that Sealed box. Nobody is told when it goes.");
    }

    @Test
    void deletionWarningNamesOnlyTheThingsThatActuallyExist() {
        when(passOnItemRepository.countByOwnerIdAndKind(margaretId, PassOnKind.STORY)).thenReturn(2L);

        Map<String, Object> warning = accountService.deletionWarning(margaretId);

        assertThat((String) warning.get("summary"))
                .isEqualTo("Deleting this account also deletes 2 stories. "
                        + "None of it can be brought back.");
        // No Sealed box, so no sentence about keys — a warning about something that is not
        // there is how people learn to stop reading warnings.
        assertThat(warning).doesNotContainKey("keyholderNote");
    }

    @Test
    void deletionWarningStaysShortWhenThereIsNothingToPassOn() {
        Map<String, Object> warning = accountService.deletionWarning(margaretId);

        assertThat(warning.get("summary")).isEqualTo("Deleting this account cannot be undone.");
        assertThat(warning.get("stories")).isEqualTo(0L);
        assertThat(warning).doesNotContainKey("keyholderNote");
    }

    @Test
    void deletionWarningRefusesAnAccountThatIsNotThere() {
        UUID unknown = UUID.randomUUID();
        when(userRepository.findById(unknown)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> accountService.deletionWarning(unknown))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    private PassOnItem story() {
        return PassOnItem.builder()
                .id(UUID.randomUUID()).owner(margaret)
                .kind(PassOnKind.STORY)
                .title("The winter we moved")
                .body("It snowed for a week and we had no coal.")
                .audience(PassOnAudience.EVERYONE)
                .releaseWhen(PassOnRelease.NOW)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private PassOnItem letterTo(User person) {
        return PassOnItem.builder()
                .id(UUID.randomUUID()).owner(margaret)
                .kind(PassOnKind.LETTER)
                .title("For Sarah")
                .body("You were always the one who rang on a Sunday.")
                .audience(PassOnAudience.PERSON)
                .audienceUser(person)
                .releaseWhen(PassOnRelease.NOW)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private SealedItem sealedItem(SealedKind kind, int byteSize) {
        return SealedItem.builder()
                .id(UUID.randomUUID()).owner(margaret)
                .labelCipher("Where the cash is hidden".getBytes(StandardCharsets.UTF_8))
                .labelIv(new byte[12])
                .kindHint(kind)
                .bodyCipher("Under the third floorboard".getBytes(StandardCharsets.UTF_8))
                .bodyIv(new byte[12])
                .wrappedKey(new byte[32])
                .byteSize(byteSize)
                .sortOrder(0)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private Keyholder keyholder(KeyholderStatus status) {
        return Keyholder.builder()
                .id(UUID.randomUUID()).owner(margaret).keyholder(sarah)
                .status(status)
                .invitedAt(LocalDateTime.now())
                .build();
    }

    private PassOnSettings settings() {
        return PassOnSettings.builder()
                .ownerId(margaretId)
                .approvalsNeeded((short) 2)
                .keyholderTarget((short) 3)
                .armedAt(LocalDateTime.now())
                .build();
    }

    private PassOnOpen open() {
        return PassOnOpen.builder()
                .id(1L).ownerId(margaretId)
                .kind(PassOnOpenKind.OPENED_BY_OWNER)
                .at(LocalDateTime.now())
                .actorLabel("Margaret")
                .build();
    }
}
