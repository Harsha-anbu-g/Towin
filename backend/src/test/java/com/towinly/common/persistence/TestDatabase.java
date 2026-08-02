package com.towinly.common.persistence;

import org.flywaydb.core.Flyway;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * The one throwaway Postgres that the DB-backed tests share.
 *
 * Tests that talk to the database over raw JDBC cannot rely on some other test class
 * having migrated it first — surefire gives no ordering guarantee — so each of them asks
 * for a connection here and gets a migrated schema whatever order it runs in. Flyway
 * migrates once per JVM and is a no-op after that.
 *
 * Reads the same {@code SPRING_DATASOURCE_*} variables as the Spring-context tests so
 * both halves of the suite can never drift onto different databases. The older
 * {@code TOWINLY_TEST_DB_*} names still win where they are set.
 *
 * Run the DB-backed tests locally with:
 *
 * <pre>
 *   createdb towin_test
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_USERNAME=postgres SPRING_DATASOURCE_PASSWORD=your-local-password \
 *   ./mvnw test
 * </pre>
 */
public final class TestDatabase {

    private static final String DEFAULT_URL = "jdbc:postgresql://localhost:5432/towin_test";
    private static final String DEFAULT_USER = "postgres";

    private static boolean migrated;

    private TestDatabase() {
    }

    public static String url() {
        return env("TOWINLY_TEST_DB_URL", env("SPRING_DATASOURCE_URL", DEFAULT_URL));
    }

    public static String user() {
        return env("TOWINLY_TEST_DB_USER", env("SPRING_DATASOURCE_USERNAME", DEFAULT_USER));
    }

    public static String password() {
        return env("TOWINLY_TEST_DB_PASSWORD", env("SPRING_DATASOURCE_PASSWORD", ""));
    }

    /** Brings the test database up to the newest migration. Safe to call any number of times. */
    public static synchronized void migrate() {
        if (migrated) return;
        Flyway.configure()
                .dataSource(url(), user(), password())
                .locations("classpath:db/migration")
                .load()
                .migrate();
        migrated = true;
    }

    /** A connection to the migrated test database. The caller closes it. */
    public static Connection connect() throws SQLException {
        migrate();
        return DriverManager.getConnection(url(), user(), password());
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value != null && !value.isBlank() ? value : fallback;
    }
}
