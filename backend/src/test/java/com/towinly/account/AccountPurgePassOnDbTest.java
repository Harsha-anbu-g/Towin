package com.towinly.account;

import com.towinly.common.entity.User;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.common.enums.SealedKind;
import com.towinly.common.enums.UserRole;
import com.towinly.common.service.S3Service;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Closing an account that has a Sealed box, against a real Postgres.
 *
 * The plan expected this to fail with a foreign-key error, on the reasoning that a column
 * declared {@code REFERENCES users(id)} with no {@code ON DELETE} clause defaults to
 * {@code NO ACTION} and {@code purgeUserData} deletes the user row last. That reasoning was
 * true of the draft schema and is no longer true of the shipped one — V50 to V53 give every
 * user-referencing column an explicit clause, so the delete succeeds on its own.
 *
 * What it does <em>not</em> do on its own is leave nothing behind. {@code passon_opens.owner_id}
 * carries no foreign key at all — deliberately, so the record survives an actor closing their
 * account — which means those rows outlive the account unless the purge names the table. Every
 * line of the record of who opened a dying woman's Sealed box, still keyed to her id, after she
 * has exercised her right to erasure. That is the defect this test exists to catch, and no
 * Mockito test can see it.
 *
 * Needs a real Postgres, so gated on TOWINLY_DB_TESTS like {@code PassOnRepositoriesDbTest}:
 *
 * <pre>
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=AccountPurgePassOnDbTest
 * </pre>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(AccountService.class)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class AccountPurgePassOnDbTest {

    // The only collaborator of AccountService that is not a repository. Nothing in this test
    // has a photo, so it is never called — it exists so the bean can be built.
    @MockitoBean
    private S3Service s3Service;

    @Autowired private AccountService accountService;
    @Autowired private PassOnItemRepository items;
    @Autowired private SealedItemRepository sealedItems;
    @Autowired private KeyholderRepository keyholders;
    @Autowired private PassOnSettingsRepository settings;
    @Autowired private PassOnOpenRepository opens;
    @Autowired private TestEntityManager entityManager;

    private User margaret;
    private User sarah;

    @BeforeEach
    void setUp() {
        margaret = entityManager.persistAndFlush(newUser("margaret"));
        sarah = entityManager.persistAndFlush(newUser("sarah"));
    }

    @Test
    void closingAnAccountWithASealedBoxSucceedsAndLeavesNothingBehind() {
        UUID margaretId = margaret.getId();
        givenMargaretHasPassedThingsOn();
        detachEverythingTheFixtureLeftManaged();

        assertThatCode(() -> accountService.purgeUserData(margaretId)).doesNotThrowAnyException();
        entityManager.flush();
        entityManager.clear();

        assertThat(items.findByOwnerIdOrderByCreatedAtDesc(margaretId)).isEmpty();
        assertThat(sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(margaretId)).isEmpty();
        assertThat(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaretId)).isEmpty();
        assertThat(settings.findById(margaretId)).isEmpty();
        // The one with no foreign key behind it, and the reason this test exists.
        assertThat(opens.findByOwnerIdOrderByAtDesc(margaretId)).isEmpty();
    }

    @Test
    void closingAKeyholdersAccountTakesTheKeyWithThemAndLeavesTheEldersLetter() {
        UUID margaretId = margaret.getId();
        UUID sarahId = sarah.getId();
        entityManager.persistAndFlush(letterFromMargaretTo(sarah));
        entityManager.persistAndFlush(sarahHoldsAKey());
        detachEverythingTheFixtureLeftManaged();

        assertThatCode(() -> accountService.purgeUserData(sarahId)).doesNotThrowAnyException();
        entityManager.flush();
        entityManager.clear();

        assertThat(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaretId)).isEmpty();
        // Margaret's letter is hers and stays hers. Only the pointer at the person who left
        // goes null — the ON DELETE SET NULL that ck_passon_person is written one-directional
        // to allow. A check written the other way round would 500 this delete.
        List<PassOnItem> hers = items.findByOwnerIdOrderByCreatedAtDesc(margaretId);
        assertThat(hers).hasSize(1);
        assertThat(hers.get(0).getAudienceUser()).isNull();
        assertThat(hers.get(0).getAudience()).isEqualTo(PassOnAudience.PERSON);
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    /**
     * A real purge arrives on its own request, with an empty persistence context. Leaving the
     * fixture's entities managed would test a situation that never happens and fail on it:
     * Hibernate would try to flush a letter still pointing in memory at the user the purge has
     * just removed, rather than letting the ON DELETE SET NULL in V50 do its job in Postgres.
     */
    private void detachEverythingTheFixtureLeftManaged() {
        entityManager.flush();
        entityManager.clear();
    }

    private void givenMargaretHasPassedThingsOn() {
        entityManager.persistAndFlush(letterFromMargaretTo(sarah));
        SealedItem sealed = entityManager.persistAndFlush(sealedItem());
        entityManager.persistAndFlush(sarahHoldsAKey());
        entityManager.persistAndFlush(PassOnSettings.builder()
                .ownerId(margaret.getId())
                .approvalsNeeded((short) 2)
                .keyholderTarget((short) 3)
                .build());
        entityManager.persistAndFlush(PassOnOpen.builder()
                .ownerId(margaret.getId())
                .sealedItemId(sealed.getId())
                .kind(PassOnOpenKind.OPENED_BY_OWNER)
                .actorLabel("Margaret")
                .build());
    }

    // No id set: PassOnItem and Keyholder generate theirs. Only SealedItem takes a
    // caller-assigned one, because its id is bound into the ciphertext as additional
    // authenticated data and so has to exist before the encryption does.
    private PassOnItem letterFromMargaretTo(User person) {
        return PassOnItem.builder()
                .owner(margaret)
                .kind(PassOnKind.LETTER)
                .title("For Sarah")
                .body("You were always the one who rang on a Sunday.")
                .audience(PassOnAudience.PERSON)
                .audienceUser(person)
                .releaseWhen(PassOnRelease.NOW)
                .build();
    }

    private SealedItem sealedItem() {
        return SealedItem.builder()
                .id(UUID.randomUUID())
                .owner(margaret)
                .labelCipher("cipher".getBytes(StandardCharsets.UTF_8))
                .labelIv(new byte[12])
                .kindHint(SealedKind.MONEY)
                .bodyCipher("cipher".getBytes(StandardCharsets.UTF_8))
                .bodyIv(new byte[12])
                .wrappedKey(new byte[32])
                .byteSize(26)
                .sortOrder(0)
                .build();
    }

    private Keyholder sarahHoldsAKey() {
        return Keyholder.builder()
                .owner(margaret)
                .keyholder(sarah)
                .status(KeyholderStatus.ACTIVE)
                .respondedAt(LocalDateTime.now())
                .build();
    }

    private User newUser(String name) {
        return User.builder()
                .username(name + "-" + UUID.randomUUID().toString().substring(0, 8))
                .email(name + "-" + UUID.randomUUID() + "@test.com")
                .passwordHash("x")
                .role(UserRole.ELDER)
                .isActive(true)
                .build();
    }
}
