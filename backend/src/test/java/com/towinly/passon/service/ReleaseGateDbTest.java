package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.passon.entity.PassOnSettings;
import com.towinly.passon.repository.PassOnSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The real {@link ReleaseGate}, unmocked, against a real Postgres.
 *
 * <h2>Why this class has to exist</h2>
 * Every other test in the feature mocks this gate, so its two lines were the one part of the
 * design asserted nowhere. That matters more here than it would anywhere else, because the
 * failure is silent and it fails <em>open</em>: drop a single {@code .map} from
 * {@link ReleaseGate#isReleased} — an easy slip in a refactor, and still perfectly readable
 * code — and every elder who has ever set up a Sealed box has her private letters handed to
 * their recipients while she is alive. The whole suite goes on passing.
 *
 * <p>So the three states are pinned separately, and each one kills a different plausible
 * mistake: no row at all, a row nobody has released, and a row somebody has.
 *
 * <p>The third writes the column the way it is genuinely written — hand-typed SQL from
 * {@code docs/operations/sealed-box-release.md}, outside JPA entirely. That is deliberate: the
 * entity maps this column {@code updatable = false} precisely so no code path can set it, and a
 * test that set it through JPA would be testing a route that must never exist while quietly
 * proving nothing about the route that does.
 *
 * <p>Needs a real Postgres, so gated on TOWINLY_DB_TESTS like {@code PassOnRepositoriesDbTest}.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class ReleaseGateDbTest {

    @Autowired
    private PassOnSettingsRepository settings;

    @Autowired
    private TestEntityManager entityManager;

    /** The real thing over the real repository. Nothing here is a mock. */
    private ReleaseGate gate;

    private User margaret;

    @BeforeEach
    void setUp() {
        gate = new ReleaseGate(settings);
        margaret = entityManager.persistAndFlush(newUser("margaret"));
    }

    @Test
    void anOwnerWhoNeverSetABoxUpIsNotReleased() {
        // No settings row at all. She has Story box entries and maybe letters, but she never
        // armed a Sealed box, so there are no Keyholders to have agreed and no row to carry a
        // release. A missing row has to read as "shut" — it is the commonest state there is.
        assertThat(gate.isReleased(margaret.getId())).isFalse();
    }

    @Test
    void anArmedBoxThatNobodyHasReleasedIsNotReleased() {
        // The one that matters most. Her box is set up, her Keyholders have said yes, and she is
        // alive and well. `findById(...).isPresent()` would answer true here and open every held
        // letter she has written to the people she wrote them to.
        armHerBox();

        assertThat(gate.isReleased(margaret.getId()))
                .describedAs("a settings row is not a release")
                .isFalse();
    }

    @Test
    void aReleaseWrittenByHandOpensTheGate() {
        armHerBox();

        releaseHerByHand();

        assertThat(gate.isReleased(margaret.getId())).isTrue();
    }

    @Test
    void nobodyIsReleasedWithoutAnOwner() {
        assertThat(gate.isReleased(null)).isFalse();
    }

    // -------------------------------------------------------------------------- helpers

    /** Two of three must agree — the smallest arrangement V53's CHECK constraints allow. */
    private void armHerBox() {
        settings.save(PassOnSettings.builder()
                .ownerId(margaret.getId())
                .approvalsNeeded((short) 2)
                .keyholderTarget((short) 3)
                .build());
        reload();
    }

    /**
     * Exactly the statement in the release procedure, run outside JPA, because that is how this
     * column is really set: by a person, at a psql prompt, at the end of a procedure no code
     * takes part in.
     */
    private void releaseHerByHand() {
        entityManager.getEntityManager()
                .createNativeQuery("UPDATE passon_settings SET released_at = now(), "
                        + "updated_at = now() WHERE owner_id = :ownerId")
                .setParameter("ownerId", margaret.getId())
                .executeUpdate();
        reload();
    }

    /**
     * Forces the next read to come from Postgres. Without the clear, the gate would answer from
     * the entity the native UPDATE above went behind the back of, and the test would pass while
     * proving nothing about the row.
     */
    private void reload() {
        entityManager.flush();
        entityManager.clear();
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
