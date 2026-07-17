package com.towin.family.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.UserRole;
import com.towin.connection.entity.Connection;
import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class FamilyEntityTest {

    // --- UserRole gains FAMILY ---

    @Test
    void userRoleEnumContainsFamily() {
        assertThat(UserRole.valueOf("FAMILY")).isNotNull();
    }

    // --- FamilyLink entity matches V38 columns ---

    @Test
    void familyLinkMapsToFamilyLinksTable() {
        Table table = FamilyLink.class.getAnnotation(Table.class);
        assertThat(table).isNotNull();
        assertThat(table.name()).isEqualTo("family_links");
    }

    @Test
    void familyLinkJoinColumnsMatchSchema() throws Exception {
        assertThat(joinColumnName(FamilyLink.class, "elder")).isEqualTo("elder_id");
        assertThat(joinColumnName(FamilyLink.class, "familyUser")).isEqualTo("family_user_id");
        assertThat(joinColumnName(FamilyLink.class, "initiatedBy")).isEqualTo("initiated_by");
    }

    @Test
    void familyLinkDefaultsToPendingNonPrimary() {
        FamilyLink link = FamilyLink.builder()
                .elder(user(UserRole.ELDER))
                .familyUser(user(UserRole.FAMILY))
                .build();
        assertThat(link.getStatus()).isEqualTo(FamilyLinkStatus.PENDING);
        assertThat(link.getIsPrimary()).isFalse();
    }

    @Test
    void familyLinkOnCreateSetsCreatedAt() throws Exception {
        FamilyLink link = new FamilyLink();
        var onCreate = FamilyLink.class.getDeclaredMethod("onCreate");
        onCreate.setAccessible(true);
        onCreate.invoke(link);
        assertThat(link.getCreatedAt()).isNotNull();
        assertThat(link.getRespondedAt()).isNull();
        assertThat(link.getRevokedAt()).isNull();
    }

    @Test
    void familyLinkStatusHasAllFourStates() {
        assertThat(FamilyLinkStatus.values())
                .extracting(Enum::name)
                .containsExactlyInAnyOrder("PENDING", "ACTIVE", "DECLINED", "REVOKED");
    }

    // --- FamilyAlert entity matches V39 columns ---

    @Test
    void familyAlertMapsToFamilyAlertsTable() {
        Table table = FamilyAlert.class.getAnnotation(Table.class);
        assertThat(table).isNotNull();
        assertThat(table.name()).isEqualTo("family_alerts");
    }

    @Test
    void familyAlertJoinsElderAndHasBody() throws Exception {
        assertThat(joinColumnName(FamilyAlert.class, "elder")).isEqualTo("elder_id");
        Field body = FamilyAlert.class.getDeclaredField("body");
        Column column = body.getAnnotation(Column.class);
        assertThat(column).isNotNull();
        assertThat(column.nullable()).isFalse();
        assertThat(column.length()).isEqualTo(500);
    }

    @Test
    void familyAlertOnCreateSetsCreatedAt() throws Exception {
        FamilyAlert alert = new FamilyAlert();
        var onCreate = FamilyAlert.class.getDeclaredMethod("onCreate");
        onCreate.setAccessible(true);
        onCreate.invoke(alert);
        assertThat(alert.getCreatedAt()).isNotNull();
    }

    // --- Connection gains sharedWithFamily mapped to shared_with_family ---

    @Test
    void connectionSharedWithFamilyDefaultsFalseAndMapsColumn() throws Exception {
        Connection connection = Connection.builder().build();
        assertThat(connection.getSharedWithFamily()).isFalse();

        Field field = Connection.class.getDeclaredField("sharedWithFamily");
        Column column = field.getAnnotation(Column.class);
        assertThat(column).isNotNull();
        assertThat(column.name()).isEqualTo("shared_with_family");
    }

    // --- helpers ---

    private static String joinColumnName(Class<?> entity, String fieldName) throws Exception {
        Field field = entity.getDeclaredField(fieldName);
        JoinColumn joinColumn = field.getAnnotation(JoinColumn.class);
        assertThat(joinColumn).as("@JoinColumn on %s.%s", entity.getSimpleName(), fieldName).isNotNull();
        assertThat(joinColumn.nullable()).isFalse();
        return joinColumn.name();
    }

    private static User user(UserRole role) {
        return User.builder().id(UUID.randomUUID()).role(role).build();
    }
}
