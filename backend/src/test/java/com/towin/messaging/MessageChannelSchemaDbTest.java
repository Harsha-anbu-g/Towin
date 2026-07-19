package com.towin.messaging;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DB-level schema tests for the V40 message channel migration (family Step 3,
 * US-001).
 *
 * The regular test suite runs without a database (Flyway/DataSource excluded in
 * src/test/resources/application.properties, and CI has no Postgres service), so
 * these tests only run when TOWIN_DB_TESTS=true is set locally:
 *
 *   TOWIN_DB_TESTS=true ./mvnw test -Dtest=MessageChannelSchemaDbTest
 *
 * They expect a locally migrated database with V40 applied (default: the local
 * towin DB, which the booted backend migrates via Flyway).
 */
@EnabledIfEnvironmentVariable(named = "TOWIN_DB_TESTS", matches = "true")
class MessageChannelSchemaDbTest {

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value != null && !value.isBlank() ? value : fallback;
    }

    private Connection open() throws SQLException {
        return DriverManager.getConnection(
                env("TOWIN_TEST_DB_URL", "jdbc:postgresql://localhost:5432/towin"),
                env("TOWIN_TEST_DB_USER", "postgres"),
                env("TOWIN_TEST_DB_PASSWORD", "0000"));
    }

    @Test
    void channelColumnIsVarchar20NotNullDefaultMain() throws Exception {
        try (Connection conn = open();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT data_type, character_maximum_length, is_nullable, column_default "
                             + "FROM information_schema.columns "
                             + "WHERE table_name = 'messages' AND column_name = 'channel'")) {
            ResultSet rs = ps.executeQuery();
            assertThat(rs.next()).as("messages.channel column exists").isTrue();
            assertThat(rs.getString("data_type")).isEqualTo("character varying");
            assertThat(rs.getInt("character_maximum_length")).isEqualTo(20);
            assertThat(rs.getString("is_nullable")).isEqualTo("NO");
            assertThat(rs.getString("column_default")).contains("MAIN");
        }
    }

    @Test
    void indexOnConnectionIdAndChannelExists() throws Exception {
        try (Connection conn = open();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT indexdef FROM pg_indexes "
                             + "WHERE tablename = 'messages' AND indexname = 'idx_messages_connection_channel'")) {
            ResultSet rs = ps.executeQuery();
            assertThat(rs.next()).as("idx_messages_connection_channel exists").isTrue();
            String def = rs.getString("indexdef");
            assertThat(def).contains("connection_id");
            assertThat(def).contains("channel");
        }
    }

    @Test
    void allRowsCarryAKnownChannelValue() throws Exception {
        // Pre-V40 rows must have been backfilled to MAIN by the column default.
        try (Connection conn = open();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT COUNT(*) FROM messages WHERE channel IS DISTINCT FROM 'MAIN' "
                             + "AND channel IS DISTINCT FROM 'FAMILY_UPDATES'")) {
            ResultSet rs = ps.executeQuery();
            rs.next();
            assertThat(rs.getLong(1))
                    .as("no messages outside MAIN/FAMILY_UPDATES")
                    .isZero();
        }
    }
}
