package com.towinly;

import com.towinly.passon.service.ReleaseContact;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The application starts. The whole of it, once, before anybody pushes.
 *
 * <h2>Why this exists</h2>
 * Every other database test in this repository is a {@code @DataJpaTest} slice: entities,
 * repositories and Flyway, and nothing else. A slice never builds the beans in between, so a
 * missing collaborator, a {@code @Value} pointing at a property nobody defines, or a security
 * chain that cannot be assembled passes the entire suite and then fails at boot — on Railway,
 * where a push to {@code main} deploys straight to production and a context that will not
 * refresh is a total outage rather than a broken screen.
 *
 * <p>It is one test on purpose. It asserts the cheapest thing there is — the context refreshed —
 * because the assertion is not where the value is. Booting is.
 *
 * <h2>What it is asked to prove beyond that</h2>
 * Three beans a slice cannot see: {@link ReleaseContact}, the {@code @Component} this branch
 * added and whose only job is to read a property that has no default; a
 * {@link SecurityFilterChain}, which is where a bad rule stops every request rather than one;
 * and at least one {@code @RestController}, so the web layer is wired and not merely compiled.
 *
 * <h2>Why the demo does not seed here</h2>
 * {@code DemoDataSeeder} is an {@code ApplicationRunner} with {@code matchIfMissing = true}, so
 * booting a context is enough to run it. {@code app.demo.seed-enabled=false} in
 * {@code src/test/resources/application.properties} keeps nineteen demo accounts and everything
 * hanging off them out of {@code towin_test}. The cost is honest and worth naming: that one bean
 * is not built here, so this test cannot catch a missing dependency inside the seeder.
 *
 * <p>Needs a real Postgres — Flyway runs at refresh and {@code ddl-auto: validate} checks every
 * entity against the migrated schema, which is most of what makes booting worth testing. Gated
 * on TOWINLY_DB_TESTS like the rest of these, so a developer without Postgres still gets a green
 * build:
 * <pre>
 *   TOWINLY_DB_TESTS=true \
 *   SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/towin_test \
 *   ./mvnw test -Dtest=ApplicationContextLoadsDbTest
 * </pre>
 */
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "TOWINLY_DB_TESTS", matches = "true")
class ApplicationContextLoadsDbTest {

    @Autowired
    private ConfigurableApplicationContext context;

    @Test
    void theWholeApplicationContextStarts() {
        assertThat(context.isActive())
                .as("the application context refreshed — every bean built, every property read")
                .isTrue();

        assertThat(context.getBean(ReleaseContact.class))
                .as("the address a family writes to when the day comes is wired at boot")
                .isNotNull();

        assertThat(context.getBeansOfType(SecurityFilterChain.class))
                .as("a security chain that cannot be assembled refuses every request")
                .isNotEmpty();

        assertThat(context.getBeanNamesForAnnotation(RestController.class))
                .as("the web layer is wired, not just the beans behind it")
                .isNotEmpty();
    }
}
