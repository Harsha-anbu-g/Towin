package com.towinly.passon;

import com.towinly.common.entity.User;
import com.towinly.common.enums.KeyholderStatus;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.enums.PassOnRelease;
import com.towinly.passon.entity.Keyholder;
import com.towinly.passon.entity.PassOnItem;
import com.towinly.passon.entity.PassOnOpen;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.repository.KeyholderRepository;
import com.towinly.passon.repository.PassOnItemRepository;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Save-and-reload proof for the four "What I pass on" entities that are not the Sealed box.
 *
 * Every one of them maps onto something the repository has never done before — enum columns
 * against fresh CHECK constraints, a shared primary key, {@code SMALLINT}, {@code BIGSERIAL},
 * and two id fields deliberately left as bare UUIDs with no association behind them. None of
 * that fails at compile time, so it gets proved against a real Postgres here. Hibernate's
 * {@code ddl-auto=validate} runs in this same context, so an entity that has drifted away
 * from V50–V53 fails before a single assertion is reached.
 *
 * Needs a real Postgres, so gated on TOWINLY_DB_TESTS like {@code MigrationsApplyDbTest}:
 *
 * <pre>
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=PassOnRepositoriesDbTest
 * </pre>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class PassOnRepositoriesDbTest {

    @Autowired
    private PassOnItemRepository items;

    @Autowired
    private KeyholderRepository keyholders;

    @Autowired
    private PassOnSettingsRepository settings;

    @Autowired
    private PassOnOpenRepository opens;

    @Autowired
    private TestEntityManager entityManager;

    private User margaret;
    private User sarah;
    private User david;

    @BeforeEach
    void setUp() {
        margaret = entityManager.persistAndFlush(newUser("margaret"));
        sarah = entityManager.persistAndFlush(newUser("sarah"));
        david = entityManager.persistAndFlush(newUser("david"));
    }

    // ------------------------------------------------------------------------ passon_items

    @Test
    void aStoryComesBackWithTheAudienceTheElderChose() {
        PassOnItem saved = items.save(story(PassOnAudience.FAMILY));
        reload();

        PassOnItem loaded = items.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getKind()).isEqualTo(PassOnKind.STORY);
        assertThat(loaded.getAudience()).isEqualTo(PassOnAudience.FAMILY);
        assertThat(loaded.getReleaseWhen()).isEqualTo(PassOnRelease.NOW);
        assertThat(loaded.getAudienceUser()).isNull();
        assertThat(loaded.getBody()).isEqualTo("We packed the car in the dark.");
        assertThat(loaded.getCreatedAt()).isNotNull();
    }

    @Test
    void aLetterKeepsThePersonItIsAddressedTo() {
        PassOnItem saved = items.save(letterTo(sarah));
        reload();

        PassOnItem loaded = items.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getKind()).isEqualTo(PassOnKind.LETTER);
        assertThat(loaded.getAudience()).isEqualTo(PassOnAudience.PERSON);
        assertThat(loaded.getAudienceUser().getId()).isEqualTo(sarah.getId());
        assertThat(loaded.getFirstReadAt()).describedAs("nobody has opened it yet").isNull();
    }

    @Test
    void theTabsAskForOneKindAndGetOnlyThatKind() {
        items.save(story(PassOnAudience.EVERYONE));
        items.save(story(PassOnAudience.HELPERS));
        items.save(letterTo(sarah));
        reload();

        assertThat(items.findByOwnerIdAndKindOrderByCreatedAtDesc(margaret.getId(), PassOnKind.STORY)).hasSize(2);
        assertThat(items.findByOwnerIdAndKindOrderByCreatedAtDesc(margaret.getId(), PassOnKind.LETTER)).hasSize(1);
        assertThat(items.findByOwnerIdOrderByCreatedAtDesc(margaret.getId()))
                .describedAs("the read page and the export both start from everything she wrote")
                .hasSize(3);
    }

    @Test
    void askingForSomebodyElsesItemByIdFindsNothing() {
        // Ownership is part of the query, so a guessed id is a miss rather than a read.
        PassOnItem margaretsStory = items.save(story(PassOnAudience.EVERYONE));
        reload();

        assertThat(items.findByIdAndOwnerId(margaretsStory.getId(), sarah.getId())).isEmpty();
        assertThat(items.findByIdAndOwnerId(margaretsStory.getId(), margaret.getId())).isPresent();
    }

    @Test
    void aPersonCanFindTheLettersAddressedToThem() {
        items.save(letterTo(sarah));
        items.save(letterTo(david));
        reload();

        List<PassOnItem> forSarah = items.findByAudienceUserIdOrderByCreatedAtDesc(sarah.getId());
        assertThat(forSarah).hasSize(1);
        assertThat(forSarah.get(0).getAudienceUser().getId()).isEqualTo(sarah.getId());
    }

    // ------------------------------------------------------------------ passon_keyholders

    @Test
    void aKeyholderStartsInvitedAndNotYetAnswered() {
        Keyholder saved = keyholders.save(Keyholder.builder().owner(margaret).keyholder(sarah).build());
        reload();

        Keyholder loaded = keyholders.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getStatus()).describedAs("nobody is conscripted; she has to say yes")
                .isEqualTo(KeyholderStatus.INVITED);
        assertThat(loaded.getInvitedAt()).isNotNull();
        assertThat(loaded.getRespondedAt()).isNull();
    }

    @Test
    void onlyActiveKeyholdersAreCounted() {
        keyholders.save(Keyholder.builder().owner(margaret).keyholder(sarah)
                .status(KeyholderStatus.ACTIVE).build());
        keyholders.save(Keyholder.builder().owner(margaret).keyholder(david)
                .status(KeyholderStatus.INVITED).build());
        reload();

        assertThat(keyholders.countByOwnerIdAndStatus(margaret.getId(), KeyholderStatus.ACTIVE)).isEqualTo(1);
        assertThat(keyholders.findByOwnerIdOrderByInvitedAtAsc(margaret.getId())).hasSize(2);
    }

    @Test
    void theInvitedPersonCanFindWhatTheyHaveBeenAskedToHold() {
        keyholders.save(Keyholder.builder().owner(margaret).keyholder(sarah).build());
        reload();

        assertThat(keyholders.findByKeyholderIdAndStatus(sarah.getId(), KeyholderStatus.INVITED)).hasSize(1);
        assertThat(keyholders.findByKeyholderIdAndStatus(david.getId(), KeyholderStatus.INVITED)).isEmpty();
        assertThat(keyholders.findByOwnerIdAndKeyholderId(margaret.getId(), sarah.getId())).isPresent();
    }

    // -------------------------------------------------------------------- passon_settings

    @Test
    void theElderSRulesComeBackAsSheSetThem() {
        settings.save(PassOnSettings.builder()
                .ownerId(margaret.getId())
                .approvalsNeeded((short) 2)
                .keyholderTarget((short) 3)
                .notAWillAckHash("a".repeat(64))
                .build());
        reload();

        // Keyed by the owner, so her id is the row's identity — there is never a second row.
        PassOnSettings loaded = settings.findById(margaret.getId()).orElseThrow();
        assertThat(loaded.getApprovalsNeeded()).isEqualTo((short) 2);
        assertThat(loaded.getKeyholderTarget()).isEqualTo((short) 3);
        assertThat(loaded.getNotAWillAckHash()).describedAs("the exact wording she was shown")
                .isEqualTo("a".repeat(64));
        assertThat(loaded.getArmedAt()).describedAs("not armed until she finishes setup").isNull();
        assertThat(loaded.getCreatedAt()).isNotNull();
    }

    // ----------------------------------------------------------------------- passon_opens

    @Test
    void anEntryInTheRecordGetsItsOwnNumberAndKeepsTheNameAsWritten() {
        PassOnOpen saved = opens.save(PassOnOpen.builder()
                .ownerId(margaret.getId())
                .kind(PassOnOpenKind.KEYHOLDER_ACCEPTED)
                .actorLabel("Sarah")
                .note("Said yes on her own phone.")
                .build());
        reload();

        assertThat(saved.getId()).describedAs("BIGSERIAL handed out an id").isNotNull();
        PassOnOpen loaded = opens.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getKind()).isEqualTo(PassOnOpenKind.KEYHOLDER_ACCEPTED);
        assertThat(loaded.getActorLabel()).isEqualTo("Sarah");
        assertThat(loaded.getAt()).isNotNull();
        assertThat(loaded.getSealedItemId()).isNull();
    }

    @Test
    void theRecordReadsBackNewestFirst() {
        opens.save(PassOnOpen.builder().ownerId(margaret.getId())
                .kind(PassOnOpenKind.CREATED).actorLabel("Margaret").build());
        opens.save(PassOnOpen.builder().ownerId(margaret.getId())
                .kind(PassOnOpenKind.BOX_ARMED).actorLabel("Margaret").build());
        opens.save(PassOnOpen.builder().ownerId(sarah.getId())
                .kind(PassOnOpenKind.CREATED).actorLabel("Sarah").build());
        reload();

        List<PassOnOpen> hers = opens.findByOwnerIdOrderByAtDesc(margaret.getId());
        assertThat(hers).describedAs("only her own lines").hasSize(2);
        assertThat(hers.get(0).getAt()).isAfterOrEqualTo(hers.get(1).getAt());
    }

    // -------------------------------------------------------------------------- helpers

    /** Forces the next read to come from Postgres rather than the entity manager's cache. */
    private void reload() {
        entityManager.flush();
        entityManager.clear();
    }

    private PassOnItem story(PassOnAudience audience) {
        return PassOnItem.builder()
                .owner(margaret)
                .kind(PassOnKind.STORY)
                .title("The summer we moved")
                .body("We packed the car in the dark.")
                .audience(audience)
                .build();
    }

    private PassOnItem letterTo(User person) {
        return PassOnItem.builder()
                .owner(margaret)
                .kind(PassOnKind.LETTER)
                .title("For you")
                .body("You were the one who stayed.")
                .audience(PassOnAudience.PERSON)
                .audienceUser(person)
                .build();
    }

    private static User newUser(String name) {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        return User.builder()
                .username(name + "_" + tag)
                .email(name + "_" + tag + "@example.test")
                .fullName(name)
                .passwordHash("x")
                .build();
    }
}
