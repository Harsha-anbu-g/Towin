# Email Verification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require new local signups to register with an email and verify it (Instagram-style) before using core features, while keeping existing accounts, demo accounts, Google, and guest accounts fully working.

**Architecture:** Add email + verification token columns to `users` (grandfathering existing rows as verified). `AuthService` generates a token at registration and sends a link via a new `EmailService` (Gmail SMTP). A `/verify-email` endpoint flips the flag. The gate is enforced by granting a `VERIFIED` authority in `JwtAuthFilter` and requiring it on write endpoints in `SecurityConfig`. Frontend gains an email field, a verify page, and a reminder banner.

**Tech Stack:** Java 21, Spring Boot 3.5, Spring Security, Spring Mail (`JavaMailSender`), Flyway, PostgreSQL, React + React Router.

**Spec:** `docs/superpowers/specs/2026-06-22-email-verification-design.md`

**Key constraints from the spec:**
- Existing + demo (`elder@gmail.com`, `helper@gmail.com`) + Google + guest accounts must stay verified/usable.
- The app must keep working — the gate only blocks 4 write actions for brand-new unverified users.
- Mail must degrade gracefully when SMTP is not configured (local dev), mirroring the existing Twilio "not configured" pattern.

---

## Files

### Backend
| File | Change |
|------|--------|
| `backend/pom.xml` | Add `spring-boot-starter-mail` |
| `backend/src/main/resources/application.yml` | Add `spring.mail` + `app.mail` blocks |
| `backend/src/main/resources/db/migration/V32__add_email_verification.sql` | **NEW** — columns + grandfather |
| `backend/src/main/java/com/towin/common/entity/User.java` | Add `emailVerified`, `emailVerificationToken`, `emailVerificationExpiresAt` |
| `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java` | Add required `email` |
| `backend/src/main/java/com/towin/auth/security/JwtUtil.java` | Add `ev` (emailVerified) claim to the token |
| `backend/src/main/java/com/towin/common/service/EmailService.java` | **NEW** — send verification email |
| `backend/src/main/java/com/towin/auth/service/AuthService.java` | register sends email; add `verifyEmail`, `resendVerification`; guest verified |
| `backend/src/main/java/com/towin/auth/dto/VerifyEmailRequest.java` | **NEW** — `{ token }` |
| `backend/src/main/java/com/towin/auth/controller/AuthController.java` | Add `verify-email`, `resend-verification` |
| `backend/src/main/java/com/towin/auth/service/OAuthService.java` | Set `emailVerified=true` for Google users |
| `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java` | Grant `VERIFIED` authority when verified |
| `backend/src/main/java/com/towin/common/security/SecurityConfig.java` | Require `VERIFIED` on write endpoints |
| `backend/src/main/java/com/towin/common/seed/DemoDataSeeder.java` | Demo users created verified |
| `backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java` | **NEW** — unit tests for verify logic |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/pages/Register.jsx` | Add required email field to the form + payload |
| `frontend/src/pages/VerifyEmail.jsx` | **NEW** — reads `?token=`, calls backend, shows result |
| `frontend/src/components/VerifyBanner.jsx` | **NEW** — "verify your email" banner + resend |
| `frontend/src/App.jsx` | Add `/verify-email` route + mount `VerifyBanner` |
| `frontend/src/context/AuthContext.jsx` | Store `emailVerified` on the user object |

---

## Chunk 1: Config & Data Foundation

### Task 1: Add the mail starter

**Files:** Modify `backend/pom.xml`

- [ ] **Step 1:** In the `<dependencies>` block (near the other `spring-boot-starter` entries around line 29-45), add:
  ```xml
  <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-mail</artifactId>
  </dependency>
  ```
- [ ] **Step 2:** Verify it resolves: `cd /Users/aghar/Documents/Projects/ToWin/backend && ./mvnw dependency:resolve -q 2>&1 | tail -5`
  Expected: no error.
- [ ] **Step 3:** Commit:
  ```bash
  git add backend/pom.xml
  git commit -m "build: add spring-boot-starter-mail"
  ```

### Task 2: Mail configuration

**Files:** Modify `backend/src/main/resources/application.yml`

- [ ] **Step 1:** Under the top-level `spring:` block (e.g. after the `security:` section ends, before line 46 `aws:`), add a `mail:` block. It must be indented two spaces under `spring:`:
  ```yaml
    mail:
      host: ${MAIL_HOST:smtp.gmail.com}
      port: ${MAIL_PORT:587}
      username: ${MAIL_USERNAME:}
      password: ${MAIL_PASSWORD:}
      properties:
        mail:
          smtp:
            auth: true
            starttls:
              enable: true
  ```
- [ ] **Step 2:** Under the top-level `app:` block (after `oauth:` around line 61), add:
  ```yaml
    mail:
      from: ${MAIL_FROM:${MAIL_USERNAME:}}
      verify-base-url: ${APP_VERIFY_BASE_URL:http://localhost:5173}
  ```
- [ ] **Step 3:** Verify YAML parses by compiling later; for now commit:
  ```bash
  git add backend/src/main/resources/application.yml
  git commit -m "config: add Gmail SMTP mail settings"
  ```

### Task 3: Flyway migration (columns + grandfather)

**Files:** Create `backend/src/main/resources/db/migration/V32__add_email_verification.sql`

- [ ] **Step 1:** Create the file with:
  ```sql
  -- Email verification: new signups must verify; everything that exists now is grandfathered.
  ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
  ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP;

  -- Grandfather: every account that exists at ship time is treated as verified
  -- so demo accounts and current test users keep working.
  UPDATE users SET email_verified = TRUE;
  ```
- [ ] **Step 2:** Commit (it runs on next app start; verified in Task 5):
  ```bash
  git add backend/src/main/resources/db/migration/V32__add_email_verification.sql
  git commit -m "db: add email verification columns, grandfather existing users"
  ```

### Task 4: User entity fields

**Files:** Modify `backend/src/main/java/com/towin/common/entity/User.java`

- [ ] **Step 1:** After the `dateOfBirth` field (around line 107), add:
  ```java
  @Column(name = "email_verified")
  @Builder.Default
  private boolean emailVerified = false;

  @Column(name = "email_verification_token")
  private String emailVerificationToken;

  @Column(name = "email_verification_expires_at")
  private LocalDateTime emailVerificationExpiresAt;
  ```
  (`LocalDateTime` is already imported.)
- [ ] **Step 2:** Compile: `cd /Users/aghar/Documents/Projects/ToWin/backend && ./mvnw compile -q 2>&1 | grep -v WARNING | tail -10`
  Expected: no errors.
- [ ] **Step 3:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/common/entity/User.java
  git commit -m "feat(user): add email verification fields"
  ```

### Task 5: Verify the schema validates at startup

**Files:** none (verification only)

- [ ] **Step 1:** Start the app against the dev DB and confirm Flyway applies V32 and JPA `validate` passes:
  ```bash
  cd /Users/aghar/Documents/Projects/ToWin/backend && SPRING_PROFILES_ACTIVE=dev timeout 60 ./mvnw spring-boot:run -q 2>&1 | grep -Ei "Migrating schema|Successfully applied|Schema-validation|Started ToWinApplication|ERROR" | head -20
  ```
  Expected: see `Successfully applied` for V32 and `Started ToWinApplication`. No `Schema-validation` error.
- [ ] **Step 2:** Stop the app (Ctrl-C / the timeout handles it). No commit (verification only).

---

## Chunk 2: EmailService

### Task 6: EmailService

**Files:** Create `backend/src/main/java/com/towin/common/service/EmailService.java`

- [ ] **Step 1:** Create the file:
  ```java
  package com.towin.common.service;

  import lombok.extern.slf4j.Slf4j;
  import org.springframework.beans.factory.annotation.Value;
  import org.springframework.mail.SimpleMailMessage;
  import org.springframework.mail.javamail.JavaMailSender;
  import org.springframework.stereotype.Service;

  /**
   * Sends transactional email via the configured SMTP server. When no SMTP
   * credentials are set (local dev) it logs the link instead of sending, so the
   * app still works without a mail server — mirrors the Twilio "not configured"
   * pattern in SosService.
   */
  @Slf4j
  @Service
  public class EmailService {

      private final JavaMailSender mailSender;
      private final String from;
      private final boolean configured;

      public EmailService(JavaMailSender mailSender,
                          @Value("${app.mail.from:}") String from,
                          @Value("${spring.mail.username:}") String username) {
          this.mailSender = mailSender;
          this.from = (from == null || from.isBlank()) ? username : from;
          this.configured = username != null && !username.isBlank();
      }

      public void sendVerificationEmail(String to, String verifyLink) {
          if (!configured) {
              // Dev convenience: no SMTP configured, so surface the link in logs.
              log.info("Mail not configured — verification link for {}: {}", to, verifyLink);
              return;
          }
          try {
              SimpleMailMessage msg = new SimpleMailMessage();
              msg.setFrom(from);
              msg.setTo(to);
              msg.setSubject("Verify your ToWin email");
              msg.setText(
                  "Welcome to ToWin!\n\n" +
                  "Please confirm your email by opening this link:\n" +
                  verifyLink + "\n\n" +
                  "This link expires in 24 hours. If you didn't sign up, you can ignore this email."
              );
              mailSender.send(msg);
              log.info("Verification email sent");
          } catch (Exception e) {
              log.error("Failed to send verification email: {}", e.getMessage());
              throw new RuntimeException("Could not send verification email. Please try again.");
          }
      }
  }
  ```
  Note: per the security fixes already shipped, do not log secrets; logging the recipient + link is acceptable only on the dev (unconfigured) path.
- [ ] **Step 2:** Compile: `cd /Users/aghar/Documents/Projects/ToWin/backend && ./mvnw compile -q 2>&1 | grep -v WARNING | tail -10`
  Expected: no errors (the mail starter provides `JavaMailSender`).
- [ ] **Step 3:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/common/service/EmailService.java
  git commit -m "feat(mail): add EmailService with graceful dev fallback"
  ```

---

## Chunk 3: AuthService, DTOs, Endpoints (TDD)

### Task 7: RegisterRequest email + JWT `ev` claim

**Files:** Modify `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java`, `backend/src/main/java/com/towin/auth/security/JwtUtil.java`

The frontend `AuthContext` derives `role` and `userId` from the JWT payload (`payload.role`, `payload.sub`), so the verified flag belongs in the JWT as a claim too — NOT in `AuthResponse` (leave `AuthResponse` unchanged, it stays 3-arg everywhere).

- [ ] **Step 1:** In `RegisterRequest.java`, add the email field (imports `jakarta.validation.constraints.*` already present):
  ```java
  @NotBlank @Email(message = "Enter a valid email address")
  private String email;
  ```
- [ ] **Step 2:** In `JwtUtil.java`, the current 4-arg `generateToken(userId, email, role, tokenVersion)` embeds `tv`. Add an `ev` (emailVerified) claim via a 5-arg overload, and make the existing methods delegate with a sensible default of `true` (so the OAuth/guest/3-arg call sites need no change — those users are verified):
  ```java
  public String generateToken(String userId, String email, String role) {
      return generateToken(userId, email, role, 0, true);
  }
  public String generateToken(String userId, String email, String role, int tokenVersion) {
      return generateToken(userId, email, role, tokenVersion, true);
  }
  public String generateToken(String userId, String email, String role, int tokenVersion, boolean emailVerified) {
      return Jwts.builder()
              .subject(userId)
              .claim("email", email)
              .claim("role", role)
              .claim("tv", tokenVersion)
              .claim("ev", emailVerified)
              .issuedAt(new Date())
              .expiration(new Date(System.currentTimeMillis() + expirationMs))
              .signWith(key)
              .compact();
  }
  ```
- [ ] **Step 3:** Compile: `./mvnw compile -q 2>&1 | grep -v WARNING | tail -10` — expect no errors.
- [ ] **Step 4:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/auth/dto/RegisterRequest.java backend/src/main/java/com/towin/auth/security/JwtUtil.java
  git commit -m "feat(auth): require email at signup, add ev (emailVerified) JWT claim"
  ```

### Task 8: VerifyEmailRequest DTO

**Files:** Create `backend/src/main/java/com/towin/auth/dto/VerifyEmailRequest.java`

- [ ] **Step 1:** Create:
  ```java
  package com.towin.auth.dto;

  import jakarta.validation.constraints.NotBlank;
  import lombok.Data;

  @Data
  public class VerifyEmailRequest {
      @NotBlank
      private String token;
  }
  ```
- [ ] **Step 2:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/auth/dto/VerifyEmailRequest.java
  git commit -m "feat(auth): add VerifyEmailRequest dto"
  ```

### Task 9: AuthService.verifyEmail — write the failing test first

**Files:** Create `backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java`

- [ ] **Step 1:** Write the test (mirrors the Mockito style in `AdminServiceTest`). AuthService has many constructor deps; use `@Mock` for the ones the verify path touches and pass the rest via a manual constructor, OR use `@InjectMocks` and only stub what's needed. Use `@InjectMocks` for simplicity:
  ```java
  package com.towin.auth;

  import com.towin.auth.service.AuthService;
  import com.towin.common.entity.User;
  import com.towin.common.repository.UserRepository;
  import org.junit.jupiter.api.Test;
  import org.junit.jupiter.api.extension.ExtendWith;
  import org.mockito.InjectMocks;
  import org.mockito.Mock;
  import org.mockito.junit.jupiter.MockitoExtension;

  import java.time.LocalDateTime;
  import java.util.Optional;
  import java.util.UUID;

  import static org.assertj.core.api.Assertions.*;
  import static org.mockito.Mockito.*;

  @ExtendWith(MockitoExtension.class)
  class AuthServiceVerifyEmailTest {

      @Mock UserRepository userRepository;
      @InjectMocks AuthService authService;

      private User userWithToken(String token, LocalDateTime expiry) {
          User u = new User();
          u.setId(UUID.randomUUID());
          u.setEmailVerified(false);
          u.setEmailVerificationToken(token);
          u.setEmailVerificationExpiresAt(expiry);
          return u;
      }

      @Test
      void verifyEmail_marksVerifiedAndClearsToken() {
          User u = userWithToken("abc", LocalDateTime.now().plusHours(1));
          when(userRepository.findByEmailVerificationToken("abc")).thenReturn(Optional.of(u));

          authService.verifyEmail("abc");

          assertThat(u.isEmailVerified()).isTrue();
          assertThat(u.getEmailVerificationToken()).isNull();
          verify(userRepository).save(u);
      }

      @Test
      void verifyEmail_rejectsUnknownToken() {
          when(userRepository.findByEmailVerificationToken("nope")).thenReturn(Optional.empty());
          assertThatThrownBy(() -> authService.verifyEmail("nope"))
              .isInstanceOf(IllegalArgumentException.class);
          verify(userRepository, never()).save(any());
      }

      @Test
      void verifyEmail_rejectsExpiredToken() {
          User u = userWithToken("old", LocalDateTime.now().minusMinutes(1));
          when(userRepository.findByEmailVerificationToken("old")).thenReturn(Optional.of(u));
          assertThatThrownBy(() -> authService.verifyEmail("old"))
              .isInstanceOf(IllegalArgumentException.class);
          assertThat(u.isEmailVerified()).isFalse();
      }
  }
  ```
- [ ] **Step 2:** Run it — expect FAIL/compile error because `verifyEmail` and `findByEmailVerificationToken` don't exist yet:
  ```bash
  cd /Users/aghar/Documents/Projects/ToWin/backend && ./mvnw test -Dtest=AuthServiceVerifyEmailTest 2>&1 | grep -E "ERROR|BUILD|Tests run" | tail -10
  ```
  Expected: compile failure (symbols missing).

### Task 10: Add the repository finder

**Files:** Modify `backend/src/main/java/com/towin/common/repository/UserRepository.java`

- [ ] **Step 1:** Add the derived query method:
  ```java
  java.util.Optional<User> findByEmailVerificationToken(String token);
  ```
  (Match the existing import style; `Optional` and `User` are likely already imported.)
- [ ] **Step 2:** Commit later with the service.

### Task 11: Implement verifyEmail + resendVerification + register-sends-email + guest verified

**Files:** Modify `backend/src/main/java/com/towin/auth/service/AuthService.java`

- [ ] **Step 1:** Add new dependencies to the class: `private final EmailService emailService;` and the verify base URL `@Value("${app.mail.verify-base-url}") private String verifyBaseUrl;` plus an `IpRateLimiter` is already used elsewhere (resend is rate-limited at the controller, so not needed here). Add imports for `EmailService` and `org.springframework.beans.factory.annotation.Value`.
- [ ] **Step 2:** In `register(...)`, set the email + token before save and send the email after save:
  ```java
  String token = java.util.UUID.randomUUID().toString().replace("-", "")
                 + Long.toHexString(SECURE_RANDOM.nextLong());
  User user = User.builder()
          .username(request.getUsername())
          .email(request.getEmail())
          .passwordHash(passwordEncoder.encode(request.getPassword()))
          .role(request.getRole())
          .dateOfBirth(request.getDateOfBirth())
          .emailVerified(false)
          .emailVerificationToken(token)
          .emailVerificationExpiresAt(LocalDateTime.now().plusHours(24))
          .build();
  ```
  Also add a duplicate-email guard near the username guard:
  ```java
  if (userRepository.existsByEmail(request.getEmail())) {
      throw new IllegalArgumentException("An account with this email already exists");
  }
  ```
  After `userRepository.save(user)` and building `id`, send the email and issue a token whose `ev` claim is false:
  ```java
  String link = verifyBaseUrl + "/verify-email?token=" + token;
  emailService.sendVerificationEmail(saved.getEmail(), link);
  String jwt = jwtUtil.generateToken(id, saved.getEmail(), saved.getRole().name(), saved.getTokenVersion(), false);
  return new AuthResponse(jwt, saved.getRole().name(), id);
  ```
  (`existsByEmail` already exists — it is used by `OAuthService`. `AuthResponse` stays 3-arg.)
- [ ] **Step 3:** In `guestLogin(...)`, add `.emailVerified(true)` to the builder so guests are not gated. Its token uses the 3-arg `generateToken` (defaults `ev=true`) — no change needed there.
- [ ] **Step 4:** In `login(...)`, issue a token carrying the user's real verified status: change the token line to `jwtUtil.generateToken(user.getId().toString(), user.getEmail(), user.getRole().name(), user.getTokenVersion(), user.isEmailVerified())`. `AuthResponse` stays 3-arg.
- [ ] **Step 5:** Add the two new methods:
  ```java
  @Transactional
  public void verifyEmail(String token) {
      User user = userRepository.findByEmailVerificationToken(token)
              .orElseThrow(() -> new IllegalArgumentException("Invalid or expired verification link."));
      if (user.getEmailVerificationExpiresAt() == null
              || user.getEmailVerificationExpiresAt().isBefore(LocalDateTime.now())) {
          throw new IllegalArgumentException("This verification link has expired. Request a new one.");
      }
      user.setEmailVerified(true);
      user.setEmailVerificationToken(null);
      user.setEmailVerificationExpiresAt(null);
      userRepository.save(user);
  }

  @Transactional
  public void resendVerification(UUID userId) {
      User user = userRepository.findById(userId)
              .orElseThrow(() -> new IllegalArgumentException("User not found"));
      if (user.isEmailVerified()) {
          return; // already verified — nothing to do
      }
      if (user.getEmail() == null || user.getEmail().isBlank()) {
          throw new IllegalArgumentException("This account has no email to verify.");
      }
      String token = java.util.UUID.randomUUID().toString().replace("-", "")
                     + Long.toHexString(SECURE_RANDOM.nextLong());
      user.setEmailVerificationToken(token);
      user.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(24));
      userRepository.save(user);
      emailService.sendVerificationEmail(user.getEmail(), verifyBaseUrl + "/verify-email?token=" + token);
  }
  ```
- [ ] **Step 6:** Run the unit test — expect PASS:
  ```bash
  cd /Users/aghar/Documents/Projects/ToWin/backend && ./mvnw test -Dtest=AuthServiceVerifyEmailTest 2>&1 | grep -E "BUILD|Tests run" | tail -5
  ```
  Expected: `Tests run: 3, Failures: 0, Errors: 0` and `BUILD SUCCESS`.
- [ ] **Step 7:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/auth/service/AuthService.java backend/src/main/java/com/towin/common/repository/UserRepository.java backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java
  git commit -m "feat(auth): email verification — register sends link, verify + resend, guest auto-verified"
  ```

### Task 12: Endpoints

**Files:** Modify `backend/src/main/java/com/towin/auth/controller/AuthController.java`

- [ ] **Step 1:** Add two endpoints (the class already has `ipRateLimiter` and imports `HttpServletRequest`, `@Valid`, `Authentication`):
  ```java
  @PostMapping("/verify-email")
  public ResponseEntity<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
      authService.verifyEmail(request.getToken());
      return ResponseEntity.ok().build();
  }

  @PostMapping("/resend-verification")
  public ResponseEntity<Void> resendVerification(Authentication auth, HttpServletRequest http) {
      ipRateLimiter.check(http);
      UUID userId = UUID.fromString(auth.getName());
      authService.resendVerification(userId);
      return ResponseEntity.ok().build();
  }
  ```
  Add `import com.towin.auth.dto.VerifyEmailRequest;` (or rely on the existing `com.towin.auth.dto.*` wildcard).
- [ ] **Step 2:** Compile: `./mvnw compile -q 2>&1 | grep -v WARNING | tail -10` — expect no errors.
- [ ] **Step 3:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/auth/controller/AuthController.java
  git commit -m "feat(auth): add verify-email and resend-verification endpoints"
  ```

---

## Chunk 4: The Gate + OAuth/Demo verified

### Task 13: Grant VERIFIED authority in JwtAuthFilter

**Files:** Modify `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java`

- [ ] **Step 1:** Inside the `userRepository.findById(...).ifPresent(user -> { ... })` block, after the tokenVersion check and inside the `isActive` branch, build the authority list to include `VERIFIED` when the user is verified. Replace:
  ```java
  List<SimpleGrantedAuthority> authorities = role != null
          ? List.of(new SimpleGrantedAuthority(role))
          : List.of();
  ```
  with:
  ```java
  java.util.List<SimpleGrantedAuthority> authorities = new java.util.ArrayList<>();
  if (role != null) authorities.add(new SimpleGrantedAuthority(role));
  if (user.isEmailVerified()) authorities.add(new SimpleGrantedAuthority("VERIFIED"));
  ```
- [ ] **Step 2:** Compile: `./mvnw compile -q 2>&1 | grep -v WARNING | tail -10` — expect no errors.

### Task 14: Require VERIFIED on write endpoints in SecurityConfig

**Files:** Modify `backend/src/main/java/com/towin/common/security/SecurityConfig.java`

- [ ] **Step 1:** Add `import org.springframework.http.HttpMethod;`.
- [ ] **Step 2:** In `authorizeHttpRequests`, add the gated matchers BEFORE `.anyRequest().authenticated()` and after the existing permitAll/admin matchers:
  ```java
  // Email-verification gate: brand-new unverified users can browse and edit
  // their profile, but these write actions require a verified email.
  .requestMatchers(HttpMethod.POST, "/api/needs/**").hasAuthority("VERIFIED")
  .requestMatchers(HttpMethod.DELETE, "/api/needs/**").hasAuthority("VERIFIED")
  .requestMatchers(HttpMethod.POST, "/api/connections/**").hasAuthority("VERIFIED")
  .requestMatchers(HttpMethod.POST, "/api/messages/**").hasAuthority("VERIFIED")
  .requestMatchers(HttpMethod.POST, "/api/reviews/**").hasAuthority("VERIFIED")
  ```
  Note: admins and all grandfathered/demo/guest/Google users have `VERIFIED`, so only brand-new unverified signups are affected. Admin endpoints keep their `hasAuthority("ADMIN")` matcher (admins are verified too).
- [ ] **Step 3:** Compile: `./mvnw compile -q 2>&1 | grep -v WARNING | tail -10` — expect no errors.
- [ ] **Step 4:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/common/security/JwtAuthFilter.java backend/src/main/java/com/towin/common/security/SecurityConfig.java
  git commit -m "feat(auth): gate write endpoints behind verified email (VERIFIED authority)"
  ```

### Task 15: Google OAuth users verified

**Files:** Modify `backend/src/main/java/com/towin/auth/service/OAuthService.java`

- [ ] **Step 1:** In `complete(...)`, the existing-account branch: after `existing.setSetupCompleted(true);` add `existing.setEmailVerified(true);`.
- [ ] **Step 2:** In the new-user `User.builder()` (around line 107), add `.emailVerified(true)`.
- [ ] **Step 3:** Both `complete` branches call the 3-arg `generateToken` (which now defaults the `ev` claim to `true`) and return the 3-arg `AuthResponse` — correct for Google users. Leave the token/response lines as-is.
- [ ] **Step 4:** Compile + commit:
  ```bash
  ./mvnw compile -q 2>&1 | grep -v WARNING | tail -5
  git add backend/src/main/java/com/towin/auth/service/OAuthService.java
  git commit -m "feat(auth): mark Google OAuth users as email-verified"
  ```

### Task 16: Demo accounts verified

**Files:** Modify `backend/src/main/java/com/towin/common/seed/DemoDataSeeder.java`

- [ ] **Step 1:** Find every `User.builder()...build()` in the seeder and add `.emailVerified(true)`. If the seeder updates/fetches existing demo users instead of building, also set `setEmailVerified(true)` on them before save. Use a grep to find them:
  ```bash
  grep -n "User.builder()\|new User(" backend/src/main/java/com/towin/common/seed/DemoDataSeeder.java
  ```
- [ ] **Step 2:** Compile: `./mvnw compile -q 2>&1 | grep -v WARNING | tail -5` — expect no errors.
- [ ] **Step 3:** Commit:
  ```bash
  git add backend/src/main/java/com/towin/common/seed/DemoDataSeeder.java
  git commit -m "feat(demo): seed demo accounts as email-verified"
  ```

### Task 17: Backend integration sanity check

**Files:** none (verification only)

- [ ] **Step 1:** Boot the app and confirm it starts cleanly with the gate in place:
  ```bash
  cd /Users/aghar/Documents/Projects/ToWin/backend && SPRING_PROFILES_ACTIVE=dev timeout 70 ./mvnw spring-boot:run -q 2>&1 | grep -Ei "Started ToWinApplication|ERROR|APPLICATION FAILED" | head
  ```
  Expected: `Started ToWinApplication`, no errors.
- [ ] **Step 2:** (Optional, if app is up in another shell) Register a new user and confirm the dev log prints the verification link, then confirm a gated call is 403 before verifying. No commit.

---

## Chunk 5: Frontend

### Task 18: AuthContext reads emailVerified from the JWT

**Files:** Modify `frontend/src/context/AuthContext.jsx`

The context already derives `role`/`userId` from the decoded JWT payload. Add `emailVerified` the same way, reading the `ev` claim. Default to `true` when the claim is absent so older/grandfathered tokens are never treated as unverified.

- [ ] **Step 1:** In the two places that build the user object from `payload` (the initial-load function around line 26 and `login` around line 34), add `emailVerified`:
  ```js
  return { token, role: payload.role, userId: payload.sub, emailVerified: payload.ev !== false };
  // and in login:
  setUser({ token, role: payload.role, userId: payload.sub, emailVerified: payload.ev !== false });
  ```
- [ ] **Step 2:** Commit:
  ```bash
  git add frontend/src/context/AuthContext.jsx
  git commit -m "feat(web): read emailVerified (ev claim) from the JWT"
  ```

### Task 19: Email field on the register form

**Files:** Modify `frontend/src/pages/Register.jsx`

- [ ] **Step 1:** Read the file to find the form state and the existing inputs (username/password). Add an `email` field to the form state, render a required email `<input type="email">` styled like the existing inputs (reuse the existing `focusIn`/`focusOut` handlers and input styles — do NOT introduce new colors; brand colors are locked), and include `email` in the payload sent to the register endpoint.
- [ ] **Step 2:** Build the frontend: `cd /Users/aghar/Documents/Projects/ToWin/frontend && npm run build 2>&1 | tail -5` — expect a successful build.
- [ ] **Step 3:** Commit:
  ```bash
  git add frontend/src/pages/Register.jsx
  git commit -m "feat(web): collect email on registration"
  ```

### Task 20: VerifyEmail page

**Files:** Create `frontend/src/pages/VerifyEmail.jsx`

- [ ] **Step 1:** Create a page that reads `?token=` from the URL, POSTs it to `/api/auth/verify-email` on mount (use the app's existing axios instance at `frontend/src/api/axios.js`), and shows one of three states: verifying / success (with a link to `/login`) / failure (with a "request a new link" hint). Match the visual style of `Privacy.jsx`/`Terms.jsx` (centered card, brand blue `#4FA3CE`). Example skeleton:
  ```jsx
  import { useEffect, useState } from 'react';
  import { useSearchParams, Link } from 'react-router-dom';
  import api from '../api/axios';

  export default function VerifyEmail() {
    const [params] = useSearchParams();
    const [state, setState] = useState('verifying'); // verifying | success | error
    useEffect(() => {
      const token = params.get('token');
      if (!token) { setState('error'); return; }
      api.post('/api/auth/verify-email', { token })
        .then(() => setState('success'))
        .catch(() => setState('error'));
    }, [params]);
    // render based on state — centered card, link to /login on success
  }
  ```
  Confirm the axios base URL/prefix matches how other calls are made (some apps already prefix `/api`); adjust the path so it hits the backend correctly.
- [ ] **Step 2:** Build: `npm run build 2>&1 | tail -5` — expect success.
- [ ] **Step 3:** Commit:
  ```bash
  git add frontend/src/pages/VerifyEmail.jsx
  git commit -m "feat(web): add /verify-email page"
  ```

### Task 21: VerifyBanner

**Files:** Create `frontend/src/components/VerifyBanner.jsx`

- [ ] **Step 1:** Create a banner that renders only when there is a logged-in user whose `emailVerified === false`. It shows "Please verify your email" and a "Resend" button that calls `POST /api/auth/resend-verification` and shows a toast (reuse `useToast` from `ToastContext` as other components do). Hide for guests (their `emailVerified` is true so it won't show). Style consistent with `BetaBanner` — no new brand colors.
- [ ] **Step 2:** Build: `npm run build 2>&1 | tail -5` — expect success.
- [ ] **Step 3:** Commit:
  ```bash
  git add frontend/src/components/VerifyBanner.jsx
  git commit -m "feat(web): add email verification reminder banner"
  ```

### Task 22: Wire route + banner into App.jsx

**Files:** Modify `frontend/src/App.jsx`

- [ ] **Step 1:** Add imports:
  ```jsx
  import VerifyEmail from './pages/VerifyEmail';
  import VerifyBanner from './components/VerifyBanner';
  ```
- [ ] **Step 2:** Add the public route alongside `/privacy` and `/terms`:
  ```jsx
  <Route path="/verify-email" element={<VerifyEmail />} />
  ```
- [ ] **Step 3:** Mount `<VerifyBanner />` in the app shell near `<BetaBanner />` (so it shows app-wide for unverified users).
- [ ] **Step 4:** Build: `npm run build 2>&1 | tail -5` — expect success.
- [ ] **Step 5:** Commit:
  ```bash
  git add frontend/src/App.jsx
  git commit -m "feat(web): route /verify-email and mount verify banner"
  ```

---

## Final Verification

- [ ] **Backend compiles:** `cd backend && ./mvnw compile -q 2>&1 | grep -v WARNING | tail -5` — no errors.
- [ ] **Targeted tests pass:** `./mvnw test -Dtest=AuthServiceVerifyEmailTest,AdminServiceTest 2>&1 | grep -E "Tests run|BUILD" | tail -5` — all pass.
- [ ] **Frontend builds:** `cd frontend && npm run build 2>&1 | tail -5` — success.
- [ ] **Manual smoke (dev, mail unconfigured):**
  1. Boot backend; register a new user; confirm the verification link is logged.
  2. Confirm a gated call (e.g. POST /api/needs) returns 403 for that user.
  3. Open the logged link's `/verify-email?token=...`; confirm success; confirm the same POST now succeeds after re-login.
  4. Log in as `elder@gmail.com` (demo) and confirm it can post/message with no banner (grandfathered/verified).
- [ ] **Push:** `git push origin main`
- [ ] **Update the audit report:** mark M6 as ✅ implemented in `docs/SECURITY-AUDIT.md`.

## Production setup (user action — document, don't automate)

- Turn on 2-Step Verification on the Google account, then create an **App Password** (Google Account → Security → App passwords).
- Set Railway env vars: `MAIL_USERNAME` (the Gmail address), `MAIL_PASSWORD` (the 16-char app password), `MAIL_FROM` (optional), `APP_VERIFY_BASE_URL` (the production frontend URL, e.g. `https://<frontend-domain>`).
- Add the same to the local `.env` for end-to-end testing.
