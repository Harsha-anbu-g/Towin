package com.towin.family;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * DB-level constraint tests for the V38 family_links schema.
 *
 * The regular test suite runs without a database (Flyway/DataSource excluded in
 * src/test/resources/application.properties, and CI has no Postgres service), so
 * these tests only run when TOWIN_DB_TESTS=true is set locally:
 *
 *   TOWIN_DB_TESTS=true ./mvnw test -Dtest=FamilySchemaConstraintDbTest
 *
 * They expect a locally migrated database (default: the towin_mig_check_ralph
 * scratch DB created for US-001, which has all 39 migrations applied).
 */
@EnabledIfEnvironmentVariable(named = "TOWIN_DB_TESTS", matches = "true")
class FamilySchemaConstraintDbTest {

    private Connection conn;
    private UUID elderId;
    private UUID familyAId;
    private UUID familyBId;

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value != null && !value.isBlank() ? value : fallback;
    }

    @BeforeEach
    void setUp() throws Exception {
        conn = DriverManager.getConnection(
                env("TOWIN_TEST_DB_URL", "jdbc:postgresql://localhost:5432/towin_mig_check_ralph"),
                env("TOWIN_TEST_DB_USER", "postgres"),
                env("TOWIN_TEST_DB_PASSWORD", "0000"));
        conn.setAutoCommit(true);
        elderId = insertUser("ELDER");
        familyAId = insertUser("FAMILY");
        familyBId = insertUser("FAMILY");
    }

    @AfterEach
    void tearDown() throws Exception {
        if (conn == null) return;
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM family_links WHERE elder_id = ? OR family_user_id = ?")) {
            ps.setObject(1, elderId);
            ps.setObject(2, elderId);
            ps.executeUpdate();
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM users WHERE id IN (?, ?, ?)")) {
            ps.setObject(1, elderId);
            ps.setObject(2, familyAId);
            ps.setObject(3, familyBId);
            ps.executeUpdate();
        }
        conn.close();
    }

    @Test
    void duplicateElderFamilyPairIsRejected() throws Exception {
        insertLink(elderId, familyAId, false, "PENDING");
        assertThatThrownBy(() -> insertLink(elderId, familyAId, false, "PENDING"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("unique_family_link");
    }

    @Test
    void selfLinkIsRejected() {
        assertThatThrownBy(() -> insertLink(elderId, elderId, false, "PENDING"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("no_self_family_link");
    }

    @Test
    void secondActivePrimaryForSameElderIsRejected() throws Exception {
        insertLink(elderId, familyAId, true, "ACTIVE");
        assertThatThrownBy(() -> insertLink(elderId, familyBId, true, "ACTIVE"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("idx_family_links_one_primary_per_elder");
    }

    @Test
    void nonActivePrimaryDoesNotBlockActivePrimary() throws Exception {
        // A REVOKED primary must not occupy the one-primary slot (partial index).
        insertLink(elderId, familyAId, true, "REVOKED");
        insertLink(elderId, familyBId, true, "ACTIVE");
        assertThat(countLinks(elderId)).isEqualTo(2);
    }

    private UUID insertUser(String role) throws SQLException {
        UUID id = UUID.randomUUID();
        String tag = id.toString().substring(0, 8);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO users (id, username, email, password_hash, role) "
                        + "VALUES (?, ?, ?, 'x', ?::user_role)")) {
            ps.setObject(1, id);
            ps.setString(2, "fam_test_" + tag);
            ps.setString(3, "fam_test_" + tag + "@example.test");
            ps.setString(4, role);
            ps.executeUpdate();
        }
        return id;
    }

    private void insertLink(UUID elder, UUID family, boolean primary, String status) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO family_links (elder_id, family_user_id, initiated_by, is_primary, status) "
                        + "VALUES (?, ?, ?, ?, ?)")) {
            ps.setObject(1, elder);
            ps.setObject(2, family);
            ps.setObject(3, elder);
            ps.setBoolean(4, primary);
            ps.setString(5, status);
            ps.executeUpdate();
        }
    }

    private long countLinks(UUID elder) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COUNT(*) FROM family_links WHERE elder_id = ?")) {
            ps.setObject(1, elder);
            ResultSet rs = ps.executeQuery();
            rs.next();
            return rs.getLong(1);
        }
    }
}
