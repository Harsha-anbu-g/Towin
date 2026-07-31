package com.towinly.passon;

import com.towinly.common.entity.User;
import com.towinly.common.enums.SealedKind;
import com.towinly.passon.entity.SealedItem;
import com.towinly.passon.repository.SealedItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.security.SecureRandom;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the Sealed box's {@code BYTEA} columns survive a save and a reload byte for byte.
 *
 * This test exists before the entity does, and deliberately so. {@code BYTEA} is
 * unprecedented in this repository — not one such column across 49 migrations, not one
 * {@code @Lob} or {@code byte[]} field across the backend — and the obvious mapping is the
 * wrong one: on Hibernate 6 a {@code @Lob byte[]} is written to {@code pg_largeobject} and
 * the column holds a four-byte OID instead of the ciphertext. That fails at runtime, not at
 * compile time, and for this feature "at runtime" means an elder's Sealed box that can never
 * be decrypted again. So the mapping gets proved first and built on second.
 *
 * The {@code octet_length} assertion is the one that actually catches the OID mapping: a
 * large-object handle is four bytes whatever you stored, so a plain equality check on the
 * loaded field could still pass through a caching entity manager while the database held
 * nothing but a pointer.
 *
 * Every builder here sets an id, because {@code SealedItem} has no {@code @GeneratedValue}:
 * the item id is bound into the ciphertext, so it is decided before the encryption and not
 * by the database. See the entity's own note, and {@code SealedBoxRoundTripDbTest}.
 *
 * Needs a real Postgres, so gated on TOWINLY_DB_TESTS the same way as
 * {@code MigrationsApplyDbTest}. CI sets it and supplies a throwaway service container:
 *
 * <pre>
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=SealedItemByteaDbTest
 * </pre>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class SealedItemByteaDbTest {

    /** Big enough that a truncating mapping shows up, and not a round number. */
    private static final int BODY_BYTES = 517;

    @Autowired
    private SealedItemRepository sealedItems;

    @Autowired
    private TestEntityManager entityManager;

    private User owner;

    @BeforeEach
    void setUp() {
        owner = entityManager.persistAndFlush(newUser());
    }

    @Test
    void aSealedItemComesBackByteForByteAfterAReload() {
        byte[] labelCipher = randomBytes(64);
        byte[] labelIv = randomBytes(12);
        byte[] bodyCipher = randomBytes(BODY_BYTES);
        byte[] bodyIv = randomBytes(12);
        byte[] wrappedKey = randomBytes(48);

        SealedItem saved = sealedItems.save(SealedItem.builder()
                .id(UUID.randomUUID())
                .owner(owner)
                .labelCipher(labelCipher)
                .labelIv(labelIv)
                .kindHint(SealedKind.MONEY)
                .bodyCipher(bodyCipher)
                .bodyIv(bodyIv)
                .wrappedKey(wrappedKey)
                .byteSize(BODY_BYTES)
                .build());

        // Force a real read: without this the entity manager can answer from its own cache
        // and the test would pass over a mapping that never touched Postgres correctly.
        entityManager.flush();
        entityManager.clear();

        SealedItem loaded = sealedItems.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getBodyCipher()).describedAs("the encrypted body").isEqualTo(bodyCipher);
        assertThat(loaded.getLabelCipher()).describedAs("the encrypted label").isEqualTo(labelCipher);
        assertThat(loaded.getBodyIv()).describedAs("the body nonce").isEqualTo(bodyIv);
        assertThat(loaded.getLabelIv()).describedAs("the label nonce").isEqualTo(labelIv);
        assertThat(loaded.getWrappedKey()).describedAs("the wrapped data key").isEqualTo(wrappedKey);
    }

    @Test
    void thePostgresColumnHoldsTheCiphertextItselfNotALargeObjectHandle() {
        byte[] bodyCipher = randomBytes(BODY_BYTES);

        SealedItem saved = sealedItems.save(SealedItem.builder()
                .id(UUID.randomUUID())
                .owner(owner)
                .labelCipher(randomBytes(64))
                .labelIv(randomBytes(12))
                .kindHint(SealedKind.PAPERS)
                .bodyCipher(bodyCipher)
                .bodyIv(randomBytes(12))
                .wrappedKey(randomBytes(48))
                .byteSize(BODY_BYTES)
                .build());
        entityManager.flush();

        Number storedLength = (Number) entityManager.getEntityManager()
                .createNativeQuery("SELECT octet_length(body_cipher) FROM passon_sealed_items WHERE id = :id")
                .setParameter("id", saved.getId())
                .getSingleResult();

        // A large-object OID is four bytes whatever you handed it.
        assertThat(storedLength.intValue())
                .describedAs("bytes actually sitting in the bytea column")
                .isEqualTo(BODY_BYTES);
    }

    @Test
    void theDefaultsTheSchemaSuppliesComeBackOnTheEntity() {
        SealedItem saved = sealedItems.save(SealedItem.builder()
                .id(UUID.randomUUID())
                .owner(owner)
                .labelCipher(randomBytes(32))
                .labelIv(randomBytes(12))
                .kindHint(SealedKind.OTHER)
                .bodyCipher(randomBytes(32))
                .bodyIv(randomBytes(12))
                .wrappedKey(randomBytes(48))
                .byteSize(32)
                .build());
        entityManager.flush();
        entityManager.clear();

        SealedItem loaded = sealedItems.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getKeyVersion()).describedAs("key version, for a future rotation").isEqualTo((short) 1);
        assertThat(loaded.getSortOrder()).isZero();
        assertThat(loaded.getCreatedAt()).isNotNull();
        assertThat(loaded.getUpdatedAt()).isNotNull();
    }

    private static byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }

    private static User newUser() {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        return User.builder()
                .username("passon_bytea_" + tag)
                .email("passon_bytea_" + tag + "@example.test")
                .passwordHash("x")
                .build();
    }
}
