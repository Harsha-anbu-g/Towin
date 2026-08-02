package com.towinly.passon;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnOpenKind;
import com.towinly.common.enums.SealedKind;
import com.towinly.common.repository.UserRepository;
import com.towinly.passon.dto.SealedItemRequest;
import com.towinly.passon.dto.SealedItemSummary;
import com.towinly.passon.dto.SealedRevealResponse;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.repository.PassOnOpenRepository;
import com.towinly.passon.repository.PassOnSettingsRepository;
import com.towinly.passon.repository.SealedItemRepository;
import com.towinly.passon.security.SealedRevealRateLimiter;
import com.towinly.passon.service.SealedBoxService;
import com.towinly.passon.service.SealedCryptoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The one test that proves a sealed item written today can still be opened tomorrow.
 *
 * <p><b>Why this exists.</b> {@code SealedBoxService#add} decides the row's UUID itself and
 * hands it to the crypto <em>before</em> the insert, because the item id is bound into the
 * ciphertext as additional authenticated data — that binding is what stops one elder's blob
 * being moved onto another elder's row. But {@code SealedItem} is annotated
 * {@code @GeneratedValue(strategy = GenerationType.UUID)}, and Spring Data routes an entity
 * that already has an id through {@code merge} rather than {@code persist}. If Hibernate
 * were to replace the assigned id on the way in, the additional authenticated data would no
 * longer match the row it sits on and <em>every sealed item in the product would be
 * permanently unreadable</em> — silently, at write time, discovered only on the day a family
 * needed the box.
 *
 * <p>No unit test can catch that: with a mocked repository the id is whatever the service
 * chose. It needs a real insert into real Postgres and a real decrypt afterwards, which is
 * exactly what this does — seal, save, drop the whole persistence context, load it back, and
 * open it. If the id ever stops surviving the insert, this test fails loudly rather than the
 * feature failing quietly.
 *
 * <p>Needs a real Postgres, so gated on TOWINLY_DB_TESTS like the rest of this package:
 * <pre>
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=SealedBoxRoundTripDbTest
 * </pre>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class SealedBoxRoundTripDbTest {

    /** Test-only key, on the same footing as the test JWT secret. Exactly 32 bytes. */
    private static final String TEST_MASTER_KEY = Base64.getEncoder()
            .encodeToString("test-only-sealed-box-key-32bytes".getBytes(StandardCharsets.UTF_8));

    private static final String PASSWORD = "a-real-password-she-typed";
    private static final String LABEL = "Where the house papers are";
    private static final String BODY = "In the brown envelope, second drawer of the writing desk.";

    @Autowired private SealedItemRepository sealedItems;
    @Autowired private PassOnSettingsRepository settings;
    @Autowired private PassOnOpenRepository opens;
    @Autowired private UserRepository users;
    @Autowired private TestEntityManager entityManager;

    private SealedBoxService service;
    private User owner;

    @BeforeEach
    void setUp() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        // The real crypto, not a mock: the point of this test is the real ciphertext landing
        // on the real row and opening again afterwards.
        // The family alerts have their own tests and no bearing on the round trip, so this
        // one is stubbed out rather than given two more repositories to write rows with.
        service = new SealedBoxService(sealedItems, settings, opens, users,
                new SealedCryptoService(TEST_MASTER_KEY), encoder,
                new SealedRevealRateLimiter(),
                org.mockito.Mockito.mock(com.towinly.passon.service.PassOnAlertService.class),
                org.mockito.Mockito.mock(com.towinly.passon.service.KeyholderService.class),
                new com.towinly.passon.service.ReleaseContact("sealedbox@example.org"),
                new com.towinly.passon.service.ReleaseGate(settings),
                Clock.systemUTC());

        String tag = UUID.randomUUID().toString().substring(0, 8);
        owner = entityManager.persistAndFlush(User.builder()
                .username("passon_seal_" + tag)
                .email("passon_seal_" + tag + "@example.test")
                .fullName("Margaret")
                .passwordHash(encoder.encode(PASSWORD))
                .build());
    }

    @Test
    void anItemSealedTodayStillOpensAfterItHasLeftMemory() {
        SealedItemSummary added = service.add(owner.getId(), request());

        // Force the row all the way to Postgres and forget everything we know about it, so
        // the read below cannot be answered from the persistence context.
        entityManager.flush();
        entityManager.clear();

        SealedRevealResponse revealed = service.reveal(owner.getId(), added.id(), PASSWORD);

        assertThat(revealed.label()).describedAs("the name she gave it").isEqualTo(LABEL);
        assertThat(revealed.body()).describedAs("what she actually wrote").isEqualTo(BODY);
        assertThat(revealed.kindHint()).isEqualTo(SealedKind.PAPERS);
    }

    @Test
    void theIdTheCiphertextWasBoundToIsTheIdTheRowKeeps() {
        SealedItemSummary added = service.add(owner.getId(), request());
        entityManager.flush();
        entityManager.clear();

        List<SealedItem> stored = sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(owner.getId());

        // Exactly one row — a merge that inserted a second copy would show up here first.
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getId())
                .describedAs("the id the ciphertext was bound to must be the id in Postgres")
                .isEqualTo(added.id());
    }

    @Test
    void theListReadsTheNameBackWithoutEverTouchingTheBody() {
        service.add(owner.getId(), request());
        entityManager.flush();
        entityManager.clear();

        assertThat(service.list(owner.getId())).singleElement().satisfies(summary -> {
            assertThat(summary.label()).isEqualTo(LABEL);
            assertThat(summary.kindHint()).isEqualTo(SealedKind.PAPERS);
            assertThat(summary.byteSize()).isEqualTo(BODY.getBytes(StandardCharsets.UTF_8).length);
        });
    }

    @Test
    void everyOpeningIsWrittenDownForTheOwnerToReadBack() {
        SealedItemSummary added = service.add(owner.getId(), request());
        entityManager.flush();
        entityManager.clear();

        service.reveal(owner.getId(), added.id(), PASSWORD);
        entityManager.flush();
        entityManager.clear();

        assertThat(opens.findByOwnerIdOrderByAtDesc(owner.getId()))
                .extracting(open -> open.getKind())
                .containsExactly(PassOnOpenKind.OPENED_BY_OWNER, PassOnOpenKind.CREATED);
    }

    private static SealedItemRequest request() {
        SealedItemRequest request = new SealedItemRequest();
        request.setLabel(LABEL);
        request.setBody(BODY);
        request.setKindHint(SealedKind.PAPERS);
        return request;
    }
}
