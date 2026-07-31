package com.towinly.common.persistence;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves every Flyway migration applies cleanly to a real Postgres.
 *
 * A bad migration is not a bad test run here — Flyway runs at boot, so a migration that
 * fails takes the whole backend down, and a push to main deploys straight to Railway.
 * Until this test existed nothing ever ran the migrations before production did.
 *
 * Boots the JPA slice only (no seeders, no S3, no OAuth) against the real database named
 * by SPRING_DATASOURCE_URL, lets Flyway migrate it, and then asks Flyway what happened.
 * Hibernate's ddl-auto=validate runs in the same context, so an entity that has drifted
 * away from the schema fails here too.
 *
 * Gated on TOWINLY_DB_TESTS so a developer without Postgres still gets a green suite,
 * matching {@code FamilySchemaConstraintDbTest}. CI sets it, with a throwaway Postgres
 * service container:
 *
 * <pre>
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=MigrationsApplyDbTest
 * </pre>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class MigrationsApplyDbTest {

    /**
     * The newest migration in the repository the day this gate was added. Asserted as a
     * floor, not an equality, so adding V50 does not break the test that guards V50.
     */
    private static final int HEAD_WHEN_THIS_GATE_WAS_ADDED = 49;

    @Autowired
    private Flyway flyway;

    @Test
    void everyMigrationOnTheClasspathHasBeenApplied() {
        assertThat(flyway.info().pending())
                .describedAs("migrations that exist in db/migration but never ran")
                .isEmpty();
    }

    @Test
    void noMigrationFailed() {
        assertThat(Arrays.stream(flyway.info().applied())
                .filter(info -> info.getState().isFailed())
                .map(MigrationInfo::getScript)
                .toList())
                .describedAs("migrations Postgres rejected")
                .isEmpty();
    }

    @Test
    void theSchemaReachesAtLeastTheHeadThisGateWasAddedFor() {
        MigrationInfo current = flyway.info().current();
        assertThat(current).describedAs("no migration has ever been applied").isNotNull();
        assertThat(Integer.parseInt(current.getVersion().getVersion()))
                .describedAs("schema version after migrating")
                .isGreaterThanOrEqualTo(HEAD_WHEN_THIS_GATE_WAS_ADDED);
    }
}
