package com.towin.common.persistence;

import com.towin.common.repository.UserRepository;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.messaging.repository.MessageRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import java.lang.reflect.Method;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Every @Query in the repositories is JPQL that only Hibernate can judge, and the rest of
 * the suite mocks the repositories away — so a typo in one would reach production unseen.
 * This boots Hibernate's mapping offline (no database, no connection is ever opened) and
 * asks it to compile each query, which is exactly what fails at startup if one is wrong.
 */
class RepositoryQueryParsingTest {

    private static final Class<?>[] REPOSITORIES = {
            MessageRepository.class,
            ConnectionRepository.class,
            NeedRepository.class,
            ElderProfileRepository.class,
            HelperProfileRepository.class,
            UserRepository.class,
            ReviewRepository.class,
            ReportRepository.class,
    };

    private static EntityManagerFactory entityManagerFactory;

    @BeforeAll
    static void bootMappingWithoutADatabase() throws Exception {
        Properties jpaProperties = new Properties();
        jpaProperties.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
        // Never ask the driver what the database looks like: the mapping is enough to compile JPQL.
        jpaProperties.put("hibernate.boot.allow_jdbc_metadata_access", "false");
        jpaProperties.put("hibernate.hbm2ddl.auto", "none");

        LocalContainerEntityManagerFactoryBean factory = new LocalContainerEntityManagerFactoryBean();
        factory.setPackagesToScan("com.towin");
        factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        factory.setDataSource(new SimpleDriverDataSource(
                new org.postgresql.Driver(), "jdbc:postgresql://localhost:5432/never-connected"));
        factory.setJpaProperties(jpaProperties);
        factory.afterPropertiesSet();

        entityManagerFactory = factory.getObject();
    }

    @AfterAll
    static void closeMapping() {
        if (entityManagerFactory != null) entityManagerFactory.close();
    }

    @Test
    void everyRepositoryQueryIsValidJpql() {
        EntityManager em = entityManagerFactory.createEntityManager();
        int compiled = 0;

        for (Class<?> repository : REPOSITORIES) {
            for (Method method : repository.getMethods()) {
                var query = method.getAnnotation(org.springframework.data.jpa.repository.Query.class);
                if (query == null || query.nativeQuery() || query.value().isBlank()) continue;

                String jpql = query.value();
                String where = repository.getSimpleName() + "." + method.getName();
                assertThatCode(() -> em.createQuery(jpql))
                        .as("%s has invalid JPQL: %s", where, jpql)
                        .doesNotThrowAnyException();
                compiled++;
            }
        }

        // Guard the guard: if the scan silently found nothing, this test proves nothing.
        assertThat(compiled).isGreaterThan(15);
        em.close();
    }
}
