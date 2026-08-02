package com.towinly.common.seed;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import com.towinly.common.seed.DemoDataSeeder.DemoSealedItem;
import com.towinly.passon.dto.SealedItemRequest;
import com.towinly.passon.dto.SealedItemSummary;
import com.towinly.passon.dto.SealedRevealResponse;
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
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The demo's own acceptance line, proved rather than asserted: <em>a visitor signing in as
 * Margaret can type the demo password and read her Sealed box back.</em>
 *
 * <p><b>Why this is not covered by the seeder's unit test.</b> That test proves the seeder
 * hands the demo content to the real {@code SealedBoxService} — which is the part a mock can
 * show. It cannot show that the result is readable, because with a mocked service nothing is
 * ever encrypted, written or decrypted. Only a real key, a real insert and a real password
 * check can answer "and does it open again", and that question is the whole point of seeding
 * the box in the first place.
 *
 * <p><b>Why it uses the seeder's own constants.</b> {@link DemoDataSeeder#MARGARET_SEALED_ITEMS}
 * and {@link DemoDataSeeder#ELDER_DEMO_PASSWORD} are the very values the demo ships. A test
 * that retyped them would go on passing after somebody changed the demo content and broke it.
 *
 * <p><b>What it deliberately does not cover.</b> There is no HTTP route for a sealed item
 * anywhere in the product — no task in this plan built one, see "What Task 12 owes" in the
 * plan — so nothing here proves a browser can reach this. It proves the seeded rows and the
 * published password are a working pair. The screen in front of them is still missing.
 *
 * <p>Needs a real Postgres, so gated on TOWINLY_DB_TESTS like the rest of these:
 * <pre>
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=DemoSealedBoxOpensDbTest
 * </pre>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class DemoSealedBoxOpensDbTest {

    /** Test-only key, on the same footing as the test JWT secret. Exactly 32 bytes. */
    private static final String TEST_MASTER_KEY = Base64.getEncoder()
            .encodeToString("test-only-sealed-box-key-32bytes".getBytes(StandardCharsets.UTF_8));

    @Autowired private SealedItemRepository sealedItems;
    @Autowired private PassOnSettingsRepository settings;
    @Autowired private PassOnOpenRepository opens;
    @Autowired private UserRepository users;
    @Autowired private TestEntityManager entityManager;

    private SealedBoxService service;
    private User margaret;

    @BeforeEach
    void setUp() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        // The real crypto and the real password check. Only the two alerting collaborators are
        // stubbed: they write family rows and have their own tests, and neither takes any part
        // in whether a sealed item opens.
        service = new SealedBoxService(sealedItems, settings, opens, users,
                new SealedCryptoService(TEST_MASTER_KEY), encoder,
                new SealedRevealRateLimiter(),
                org.mockito.Mockito.mock(com.towinly.passon.service.PassOnAlertService.class),
                org.mockito.Mockito.mock(com.towinly.passon.service.KeyholderService.class),
                new com.towinly.passon.service.ReleaseContact("sealedbox@example.org"),
                new com.towinly.passon.service.ReleaseGate(settings),
                Clock.systemUTC());

        String tag = UUID.randomUUID().toString().substring(0, 8);
        margaret = entityManager.persistAndFlush(User.builder()
                .username("demo_margaret_" + tag)
                .email("demo_margaret_" + tag + "@example.test")
                .phone("+1416555" + tag.substring(0, 4))
                // Hashed exactly as the seeder hashes it, from the same constant.
                .passwordHash(encoder.encode(DemoDataSeeder.ELDER_DEMO_PASSWORD))
                .role(UserRole.ELDER)
                .verificationStatus(VerificationStatus.VERIFIED)
                .emailVerified(true)
                .dateOfBirth(LocalDate.of(1953, 5, 14))
                .isActive(true)
                .build());
    }

    /**
     * Seeds the demo box exactly as {@code DemoDataSeeder} does.
     *
     * <p>The size check is not decoration. Every assertion below is driven by the seeder's own
     * list, so an empty list would make all three tests pass while the demo Sealed box opened
     * on nothing — the exact failure this file exists to prevent.
     */
    private void sealTheDemoBox() {
        assertThat(DemoDataSeeder.MARGARET_SEALED_ITEMS)
                .as("the demo box has to contain something to be worth opening")
                .hasSizeGreaterThanOrEqualTo(3);

        for (DemoSealedItem item : DemoDataSeeder.MARGARET_SEALED_ITEMS) {
            SealedItemRequest request = new SealedItemRequest();
            request.setLabel(item.label());
            request.setBody(item.body());
            request.setKindHint(item.kind());
            service.add(margaret.getId(), request);
        }
        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void theDemoPasswordOpensEveryItemInTheDemoBox() {
        sealTheDemoBox();

        List<SealedItemSummary> box = service.list(margaret.getId());
        assertThat(box).as("the demo box is not empty").hasSize(DemoDataSeeder.MARGARET_SEALED_ITEMS.size());

        for (DemoSealedItem expected : DemoDataSeeder.MARGARET_SEALED_ITEMS) {
            SealedItemSummary row = box.stream()
                    .filter(s -> expected.label().equals(s.label()))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError(
                            "The demo box has no item named " + expected.label()));

            SealedRevealResponse opened = service.reveal(
                    margaret.getId(), row.id(), DemoDataSeeder.ELDER_DEMO_PASSWORD);

            assertThat(opened.label()).isEqualTo(expected.label());
            assertThat(opened.body())
                    .as("what she wrote comes back word for word")
                    .isEqualTo(expected.body());
            assertThat(opened.kindHint()).isEqualTo(expected.kind());
        }
    }

    @Test
    void nothingReadableIsWrittenBesideTheCiphertext() {
        sealTheDemoBox();

        // The demo ships public content on a public database. If any of it were legible on the
        // row, the demo would be teaching the opposite of what the feature promises.
        String everyByte = sealedItems.findByOwnerIdOrderBySortOrderAscCreatedAtAsc(margaret.getId())
                .stream()
                .map(item -> new String(item.getLabelCipher(), StandardCharsets.ISO_8859_1)
                        + new String(item.getBodyCipher(), StandardCharsets.ISO_8859_1))
                .reduce("", String::concat);

        for (DemoSealedItem item : DemoDataSeeder.MARGARET_SEALED_ITEMS) {
            assertThat(everyByte).doesNotContain(item.label());
            assertThat(everyByte).doesNotContain(item.body());
        }
    }

    @Test
    void someoneElsesPasswordOpensNothing() {
        sealTheDemoBox();

        UUID itemId = service.list(margaret.getId()).get(0).id();

        assertThat(org.assertj.core.api.Assertions.catchThrowable(
                () -> service.reveal(margaret.getId(), itemId, "not-the-demo-password")))
                .as("the published password is the gate, not a formality")
                .isInstanceOf(IllegalArgumentException.class);
    }
}
