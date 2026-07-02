package com.towin.common.seed;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;

/**
 * Bootstraps the platform admin account at startup from environment config
 * ({@code ADMIN_EMAIL} / {@code ADMIN_PASSWORD}) instead of a committed database
 * migration, so no usable admin credential ever lives in the repository.
 *
 * <p>Idempotent and self-healing: on every boot it reconciles the admin row to
 * match the configured password. If the account already exists (e.g. an older
 * deployment where a migration created it), its password hash is rewritten to
 * the configured value — the migration's hash is thereby rotated out and made
 * worthless. When it does not exist, it is created.
 *
 * <p>If either {@code ADMIN_EMAIL} or {@code ADMIN_PASSWORD} is blank, bootstrap
 * is skipped with a warning and the app continues normally. Runs after Flyway
 * (which executes during context init) so any migration-seeded admin row is
 * already present and simply gets reconciled here.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Order(0) // run before DemoDataSeeder; the two are independent, but keep admin first
public class AdminSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PlatformTransactionManager transactionManager;

    @Value("${app.admin.email:}")
    private String adminEmail;

    @Value("${app.admin.password:}")
    private String adminPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (adminEmail == null || adminEmail.isBlank()
                || adminPassword == null || adminPassword.isBlank()) {
            log.warn("Admin bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD to "
                    + "create/manage the admin account. No admin credential is stored in the repo.");
            return;
        }
        try {
            // Read-modify-write in one transaction so the entity stays managed.
            new TransactionTemplate(transactionManager).executeWithoutResult(status -> seedAdmin());
        } catch (Exception e) {
            log.error("Admin bootstrap failed (app continues normally)", e);
        }
    }

    private void seedAdmin() {
        Optional<User> existing = userRepository.findByEmail(adminEmail);
        if (existing.isPresent()) {
            User u = existing.get();
            boolean dirty = false;
            if (u.getRole() != UserRole.ADMIN) {
                u.setRole(UserRole.ADMIN);
                dirty = true;
            }
            if (Boolean.FALSE.equals(u.getIsActive())) {
                u.setIsActive(true);
                dirty = true;
            }
            // Enforce the configured password as the source of truth; rewrite only
            // when it has actually drifted, to avoid a needless bcrypt hash per boot.
            if (u.getPasswordHash() == null || !passwordEncoder.matches(adminPassword, u.getPasswordHash())) {
                u.setPasswordHash(passwordEncoder.encode(adminPassword));
                dirty = true;
            }
            if (dirty) {
                userRepository.save(u);
                log.info("Admin account '{}' reconciled from environment config", adminEmail);
            }
            return;
        }

        User admin = User.builder()
                .username(uniqueAdminUsername(adminEmail))
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .role(UserRole.ADMIN)
                .verificationStatus(VerificationStatus.VERIFIED)
                .emailVerified(true)
                .setupCompleted(true)
                .isActive(true)
                .build();
        userRepository.save(admin);
        log.info("Admin account '{}' created from environment config", adminEmail);
    }

    private String uniqueAdminUsername(String email) {
        String base = email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9]", "_");
        if (userRepository.existsByUsername(base)) {
            return base + "_" + (System.currentTimeMillis() % 1000);
        }
        return base;
    }
}
