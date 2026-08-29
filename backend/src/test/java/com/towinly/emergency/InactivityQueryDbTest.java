package com.towinly.emergency;

import com.towinly.common.entity.User;
import com.towinly.common.enums.UserRole;
import com.towinly.common.enums.VerificationStatus;
import com.towinly.common.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The inactivity cron ran every morning at 09:00 and failed every morning, because
 * {@code findInactiveElders} compared {@code u.role} with a JPQL enum literal. The column is a
 * Postgres named enum ({@code user_role}); Hibernate rendered the literal as a cast to the Java
 * simple name, a type Postgres has never had. {@code RepositoryQueryParsingTest} stayed green
 * the whole time: the query parses, it just cannot run. Only a real Postgres can say so, hence
 * this test, gated like the other DB-backed ones.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class InactivityQueryDbTest {

    @Autowired TestEntityManager entityManager;
    @Autowired UserRepository userRepository;

    @Test
    void findInactiveElders_runsOnPostgresAndReturnsTheQuietElder() {
        LocalDateTime now = LocalDateTime.now();
        User quietElder = persistUser(UserRole.ELDER, now.minusDays(6));
        User quietHelper = persistUser(UserRole.HELPER, now.minusDays(6));
        User activeElder = persistUser(UserRole.ELDER, now.minusHours(2));
        entityManager.flush();
        entityManager.clear();

        List<User> found = userRepository.findInactiveElders(now.minusDays(5), now.minusDays(7));

        assertThat(found).extracting(User::getId)
                .contains(quietElder.getId())
                .doesNotContain(quietHelper.getId(), activeElder.getId());
    }

    private User persistUser(UserRole role, LocalDateTime lastSeenAt) {
        String tag = UUID.randomUUID().toString().substring(0, 8);
        User user = User.builder()
                .username("inactive_" + tag)
                .email("inactive-" + tag + "@test.local")
                .phone("+1" + tag.hashCode())
                .passwordHash("hash")
                .role(role)
                .trustScore(0.0)
                .verificationStatus(VerificationStatus.NONE)
                .isActive(true)
                .lastSeenAt(lastSeenAt)
                .build();
        return entityManager.persist(user);
    }
}
