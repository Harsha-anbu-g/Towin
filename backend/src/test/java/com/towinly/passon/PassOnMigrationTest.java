package com.towinly.passon;

import com.towinly.common.persistence.TestDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * DB-level constraint tests for the V50–V53 "What I pass on" schema.
 *
 * These rules are the safety argument for the whole feature, so they live in Postgres
 * rather than in a service that a later refactor could route around. Three matter most:
 * a box one person can open alone is not a lock ({@code ck_quorum_min}); a box everybody
 * must agree on is the permanent deadlock the owner rejected ({@code ck_quorum_lt_pool});
 * and a named person deleting their account must null the address on a letter rather than
 * break the delete ({@code ck_passon_person}, deliberately one-directional).
 *
 * Needs a real Postgres, so gated on TOWINLY_DB_TESTS the same way as
 * {@code FamilySchemaConstraintDbTest}. CI sets it and supplies a throwaway service
 * container; locally see {@link TestDatabase}. {@code TestDatabase} migrates the schema
 * too, so this class does not depend on some other test having run first.
 */
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class PassOnMigrationTest {

    private Connection conn;
    private UUID ownerId;
    private UUID personId;
    private UUID otherId;

    @BeforeEach
    void setUp() throws Exception {
        conn = TestDatabase.connect();
        conn.setAutoCommit(true);
        ownerId = insertUser("ELDER");
        personId = insertUser("FAMILY");
        otherId = insertUser("FAMILY");
    }

    @AfterEach
    void tearDown() throws Exception {
        if (conn == null) return;
        // passon_opens carries no user FK on purpose, so it never cascades — clear it first.
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM passon_opens WHERE owner_id = ?")) {
            ps.setObject(1, ownerId);
            ps.executeUpdate();
        } catch (SQLException ignored) {
            // Table may not exist yet on a red run; the user delete below is what matters.
        }
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM users WHERE id IN (?, ?, ?)")) {
            ps.setObject(1, ownerId);
            ps.setObject(2, personId);
            ps.setObject(3, otherId);
            ps.executeUpdate();
        }
        conn.close();
    }

    // ---------------------------------------------------------------- V50 passon_items

    @Test
    void aStoryForEveryoneIsAccepted() throws Exception {
        insertItem(UUID.randomUUID(), "STORY", "EVERYONE", null, "NOW");
        assertThat(countItems()).isEqualTo(1);
    }

    @Test
    void anUnknownKindIsRejected() {
        assertThatThrownBy(() -> insertItem(UUID.randomUUID(), "NOTE", "EVERYONE", null, "NOW"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_passon_kind");
    }

    @Test
    void anUnknownAudienceIsRejected() {
        assertThatThrownBy(() -> insertItem(UUID.randomUUID(), "STORY", "NOBODY", null, "NOW"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_passon_audience");
    }

    @Test
    void anUnknownReleaseTimeIsRejected() {
        assertThatThrownBy(() -> insertItem(UUID.randomUUID(), "LETTER", "PERSON", personId, "LATER"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_passon_release");
    }

    @Test
    void namingAPersonWithoutThePersonAudienceIsRejected() {
        assertThatThrownBy(() -> insertItem(UUID.randomUUID(), "STORY", "FAMILY", personId, "NOW"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_passon_person");
    }

    @Test
    void aLetterWithoutANamedPersonIsRejected() {
        assertThatThrownBy(() -> insertItem(UUID.randomUUID(), "LETTER", "FAMILY", null, "NOW"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_passon_letter");
    }

    @Test
    void aStoryHeldBackUntilAfterIsRejected() {
        assertThatThrownBy(() -> insertItem(UUID.randomUUID(), "STORY", "EVERYONE", null, "AFTER"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_passon_story");
    }

    @Test
    void deletingTheNamedPersonNullsTheAddressInsteadOfBreakingTheDelete() throws Exception {
        UUID letterId = UUID.randomUUID();
        insertItem(letterId, "LETTER", "PERSON", personId, "NOW");

        deleteUser(personId);

        // The check is one-directional on purpose: written the other way round, this
        // SET NULL cascade would violate the very constraint that allowed the row.
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT audience, audience_user_id FROM passon_items WHERE id = ?")) {
            ps.setObject(1, letterId);
            ResultSet rs = ps.executeQuery();
            assertThat(rs.next()).describedAs("the letter survived the named person's deletion").isTrue();
            assertThat(rs.getString("audience")).isEqualTo("PERSON");
            assertThat(rs.getObject("audience_user_id")).isNull();
        }
    }

    @Test
    void deletingTheOwnerRemovesTheirItems() throws Exception {
        insertItem(UUID.randomUUID(), "STORY", "EVERYONE", null, "NOW");

        deleteUser(ownerId);

        assertThat(countItems()).isZero();
    }

    // ---------------------------------------------------------- V51 passon_sealed_items

    @Test
    void aSealedItemIsAccepted() throws Exception {
        insertSealedItem(UUID.randomUUID(), "MONEY");
        assertThat(countSealedItems()).isEqualTo(1);
    }

    @Test
    void anUnknownSealedKindIsRejected() {
        assertThatThrownBy(() -> insertSealedItem(UUID.randomUUID(), "SECRETS"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_sealed_kind");
    }

    @Test
    void theSealedTableHasNoPlaintextLabelOrFilename() throws Exception {
        // A readable "Where the cash is hidden" beside the ciphertext, attached to a named
        // elderly person at a known address, would make the encryption decorative.
        assertThat(columnsOf("passon_sealed_items"))
                .contains("label_cipher", "body_cipher", "kind_hint")
                .doesNotContain("label", "file_name", "filename", "body", "note");
    }

    // ------------------------------------------------------------ V52 passon_keyholders

    @Test
    void aKeyholderInviteIsAccepted() throws Exception {
        insertKeyholder(ownerId, personId, "INVITED");
        assertThat(countKeyholders()).isEqualTo(1);
    }

    @Test
    void theSameKeyholderTwiceIsRejected() throws Exception {
        insertKeyholder(ownerId, personId, "INVITED");
        assertThatThrownBy(() -> insertKeyholder(ownerId, personId, "ACTIVE"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("uq_keyholder");
    }

    @Test
    void anOwnerHoldingTheirOwnKeyIsRejected() {
        assertThatThrownBy(() -> insertKeyholder(ownerId, ownerId, "ACTIVE"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_keyholder_self");
    }

    @Test
    void anUnknownKeyholderStatusIsRejected() {
        assertThatThrownBy(() -> insertKeyholder(ownerId, personId, "MAYBE"))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_keyholder_status");
    }

    // -------------------------------------------------------------- V53 passon_settings

    @Test
    void twoApprovalsOutOfThreeKeyholdersIsAccepted() throws Exception {
        insertSettings(2, 3);
        assertThat(countSettings()).isEqualTo(1);
    }

    @Test
    void aBoxOnePersonCouldOpenAloneIsRejected() {
        assertThatThrownBy(() -> insertSettings(1, 3))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_quorum_min");
    }

    @Test
    void requiringEveryKeyholderToAgreeIsRejected() {
        // Unanimity is a permanent deadlock the first time one keyholder is unreachable.
        assertThatThrownBy(() -> insertSettings(3, 3))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_quorum_lt_pool");
    }

    @Test
    void aKeyholderPoolBiggerThanFiveIsRejected() {
        assertThatThrownBy(() -> insertSettings(2, 6))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("ck_pool_range");
    }

    // ------------------------------------------------------ V56 passon_settings.released_at

    @Test
    void aBoxThatWasNeverReleasedHasNoReleaseDate() throws Exception {
        // Null is where every row starts and where almost every row stays forever. Nothing in
        // the code writes this column; only a person running the release procedure by hand does.
        insertSettings(2, 3);

        assertThat(releasedAt()).describedAs("nothing has been released").isNull();
    }

    @Test
    void aReleaseWrittenByHandIsWhatOpensTheBox() throws Exception {
        insertSettings(2, 3);

        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE passon_settings SET released_at = now() WHERE owner_id = ?")) {
            ps.setObject(1, ownerId);
            ps.executeUpdate();
        }

        assertThat(releasedAt()).describedAs("the one switch, set by a person").isNotNull();
    }

    // ----------------------------------------------------------------- V53 passon_opens

    @Test
    void anOpenRowSurvivesTheSealedItemBeingDeleted() throws Exception {
        UUID sealedId = UUID.randomUUID();
        insertSealedItem(sealedId, "PAPERS");
        insertOpen(sealedId, "OPENED_BY_OWNER", "Margaret");

        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM passon_sealed_items WHERE id = ?")) {
            ps.setObject(1, sealedId);
            ps.executeUpdate();
        }

        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT sealed_item_id FROM passon_opens WHERE owner_id = ?")) {
            ps.setObject(1, ownerId);
            ResultSet rs = ps.executeQuery();
            assertThat(rs.next()).describedAs("the audit row survived").isTrue();
            assertThat(rs.getObject("sealed_item_id")).isNull();
        }
    }

    @Test
    void anOpenRowSurvivesTheActorDeletingTheirAccount() throws Exception {
        insertOpen(null, "KEYHOLDER_ACCEPTED", "Sarah");

        deleteUser(personId);

        // actor_label is a label, not a user FK, so DELETE /api/account never trips over it.
        assertThat(countOpens()).isEqualTo(1);
    }

    // -------------------------------------------------------------------------- helpers

    private UUID insertUser(String role) throws SQLException {
        UUID id = UUID.randomUUID();
        String tag = id.toString().substring(0, 8);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO users (id, username, email, password_hash, role) "
                        + "VALUES (?, ?, ?, 'x', ?::user_role)")) {
            ps.setObject(1, id);
            ps.setString(2, "passon_test_" + tag);
            ps.setString(3, "passon_test_" + tag + "@example.test");
            ps.setString(4, role);
            ps.executeUpdate();
        }
        return id;
    }

    private void deleteUser(UUID id) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("DELETE FROM users WHERE id = ?")) {
            ps.setObject(1, id);
            ps.executeUpdate();
        }
    }

    private void insertItem(UUID id, String kind, String audience, UUID audienceUser, String releaseWhen)
            throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO passon_items (id, owner_id, kind, title, body, audience, audience_user_id, release_when) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
            ps.setObject(1, id);
            ps.setObject(2, ownerId);
            ps.setString(3, kind);
            ps.setString(4, "The summer we moved");
            ps.setString(5, "We packed the car in the dark.");
            ps.setString(6, audience);
            ps.setObject(7, audienceUser);
            ps.setString(8, releaseWhen);
            ps.executeUpdate();
        }
    }

    private void insertSealedItem(UUID id, String kindHint) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO passon_sealed_items "
                        + "(id, owner_id, label_cipher, label_iv, kind_hint, body_cipher, body_iv, wrapped_key, byte_size) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            ps.setObject(1, id);
            ps.setObject(2, ownerId);
            ps.setBytes(3, new byte[] {1, 2, 3});
            ps.setBytes(4, new byte[] {4, 5, 6});
            ps.setString(5, kindHint);
            ps.setBytes(6, new byte[] {7, 8, 9});
            ps.setBytes(7, new byte[] {10, 11, 12});
            ps.setBytes(8, new byte[] {13, 14, 15});
            ps.setInt(9, 3);
            ps.executeUpdate();
        }
    }

    private void insertKeyholder(UUID owner, UUID keyholder, String status) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO passon_keyholders (id, owner_id, keyholder_id, status) VALUES (?, ?, ?, ?)")) {
            ps.setObject(1, UUID.randomUUID());
            ps.setObject(2, owner);
            ps.setObject(3, keyholder);
            ps.setString(4, status);
            ps.executeUpdate();
        }
    }

    private void insertSettings(int approvalsNeeded, int keyholderTarget) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO passon_settings (owner_id, approvals_needed, keyholder_target) VALUES (?, ?, ?)")) {
            ps.setObject(1, ownerId);
            ps.setInt(2, approvalsNeeded);
            ps.setInt(3, keyholderTarget);
            ps.executeUpdate();
        }
    }

    private void insertOpen(UUID sealedItemId, String kind, String actorLabel) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO passon_opens (owner_id, sealed_item_id, kind, actor_label) VALUES (?, ?, ?, ?)")) {
            ps.setObject(1, ownerId);
            ps.setObject(2, sealedItemId);
            ps.setString(3, kind);
            ps.setString(4, actorLabel);
            ps.executeUpdate();
        }
    }

    private java.sql.Timestamp releasedAt() throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT released_at FROM passon_settings WHERE owner_id = ?")) {
            ps.setObject(1, ownerId);
            ResultSet rs = ps.executeQuery();
            assertThat(rs.next()).describedAs("her settings row is there").isTrue();
            return rs.getTimestamp("released_at");
        }
    }

    private long countItems() throws SQLException {
        return countBy("SELECT COUNT(*) FROM passon_items WHERE owner_id = ?");
    }

    private long countSealedItems() throws SQLException {
        return countBy("SELECT COUNT(*) FROM passon_sealed_items WHERE owner_id = ?");
    }

    private long countKeyholders() throws SQLException {
        return countBy("SELECT COUNT(*) FROM passon_keyholders WHERE owner_id = ?");
    }

    private long countSettings() throws SQLException {
        return countBy("SELECT COUNT(*) FROM passon_settings WHERE owner_id = ?");
    }

    private long countOpens() throws SQLException {
        return countBy("SELECT COUNT(*) FROM passon_opens WHERE owner_id = ?");
    }

    private long countBy(String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, ownerId);
            ResultSet rs = ps.executeQuery();
            rs.next();
            return rs.getLong(1);
        }
    }

    private java.util.List<String> columnsOf(String table) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT column_name FROM information_schema.columns WHERE table_name = ?")) {
            ps.setString(1, table);
            ResultSet rs = ps.executeQuery();
            java.util.List<String> names = new java.util.ArrayList<>();
            while (rs.next()) {
                names.add(rs.getString(1));
            }
            return names;
        }
    }
}
