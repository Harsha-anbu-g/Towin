# Auth Rework: Pending-Until-Verified + Google-First Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only create a real account after the email is verified (Instagram-style), make Google sign-in password-free and primary, add a forgot/set-password flow, and remove the now-dead verification wall/gate.

**Architecture:** Manual signups are held in a `pending_registrations` staging table and the real `users` row is created only when the link is clicked. Google users (already verified by Google) are created without a forced password. A reset-token flow lets any user set/recover a password by email. Because every `users` row is now verified by definition, the frontend wall, the `VERIFIED` authority, and the `ev` JWT claim are removed.

**Tech Stack:** Java 21, Spring Boot 3.5, Spring Security, Flyway, PostgreSQL, Brevo HTTPS email, React + React Router.

**Confirmed decisions (from discussion):**
- Staging table (`pending_registrations`), not the accounts table, holds unverified signups. Deleted on verify.
- Google = password-free; "Sign in with Google" becomes the primary button. Phone stays required at Google onboarding (unchanged).
- Forgot/Set password by email (reset token).
- Remove the wall (`/verify-pending` + route guards) and gate (`VERIFIED` authority + matchers + `ev` claim). The 4-action write gate is no longer needed because no unverified user can ever be logged in.
- Trade-off accepted: if a manual user never clicks the link, no account is created (they re-register).

**Accepted edge cases:**
- Re-registering the same email before verifying: the old pending row is replaced.
- Forgot-password and resend endpoints always return 200 (no account enumeration).
- DB columns made unused by this change (`users.email_verification_token/expires_at`) are LEFT in place — dropping columns is destructive and out of scope.

---

## File Map

### Backend — create
- `auth/dto/PendingRegistration.java` … no — entity goes in `common/entity/`
- `common/entity/PendingRegistration.java` — staging entity
- `common/repository/PendingRegistrationRepository.java`
- `auth/dto/ForgotPasswordRequest.java`, `auth/dto/ResetPasswordRequest.java`
- `db/migration/V33__create_pending_registrations.sql`
- `db/migration/V34__add_password_reset.sql`

### Backend — modify
- `auth/service/AuthService.java` — register→pending, verifyEmail→create user, resendVerification(email), forgotPassword, resetPassword, guest/login token (drop `ev`)
- `auth/controller/AuthController.java` — register returns 200 (no token); verify-email unchanged; resend now public by email; add forgot/reset
- `auth/dto/VerifyEmailRequest.java` — unchanged
- `auth/service/OAuthService.java` — password optional
- `auth/dto/OAuthCompleteRequest.java` — password optional
- `common/repository/UserRepository.java` — `findByPasswordResetToken`
- `common/entity/User.java` — add `passwordResetToken`, `passwordResetExpiresAt`
- `common/service/EmailService.java` — add `sendPasswordResetEmail`
- `common/security/SecurityConfig.java` — remove `VERIFIED` matchers; make `resend-verification` public; add nothing else (forgot/reset already under `/api/auth/**` permitAll)
- `common/security/JwtAuthFilter.java` — remove `VERIFIED` authority block (role-only again)
- `auth/security/JwtUtil.java` — leave overloads; callers stop passing `ev`

### Frontend — create
- `pages/CheckEmail.jsx` — "we sent a link" page after manual signup
- `pages/ForgotPassword.jsx`, `pages/ResetPassword.jsx`

### Frontend — modify
- `pages/Register.jsx` — on success go to `/check-email` (no login); Google button primary
- `pages/Login.jsx` — Google button primary; "Forgot password?" link
- `pages/VerifyEmail.jsx` — success copy → "account ready, log in"
- `pages/FinishSetup.jsx` — remove password fields; don't send password
- `App.jsx` — remove `needsVerify` guards + `/verify-pending`; add `/check-email`, `/forgot-password`, `/reset-password`
- (Orphaned after this: `pages/VerifyPending.jsx`, `components/VerifyBanner.jsx` — leave files; ask before deleting)

---

## Chunk 1: Backend — Pending registration (manual signup)

### Task 1: PendingRegistration entity + repository

- [ ] Create `backend/src/main/java/com/towin/common/entity/PendingRegistration.java`:
```java
package com.towin.common.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "pending_registrations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PendingRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String username;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // Stored as plain text (the user_role Postgres enum is only used on the real users table).
    @Column(nullable = false, length = 20)
    private String role;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() { this.createdAt = LocalDateTime.now(); }
}
```
- [ ] Create `backend/src/main/java/com/towin/common/repository/PendingRegistrationRepository.java`:
```java
package com.towin.common.repository;

import com.towin.common.entity.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.UUID;

public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, UUID> {
    Optional<PendingRegistration> findByToken(String token);

    @Modifying
    @Transactional
    void deleteByEmail(String email);
}
```

### Task 2: Migration V33

- [ ] Create `backend/src/main/resources/db/migration/V33__create_pending_registrations.sql`:
```sql
CREATE TABLE pending_registrations (
    id UUID PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_pending_email ON pending_registrations(email);
```

### Task 3: AuthService.register → write to pending (not users)

- [ ] In `AuthService`, inject `PendingRegistrationRepository pendingRepository` (add `private final` field + import).
- [ ] Replace the body of `register(RegisterRequest request)` so it returns **void** and creates a pending row instead of a user:
```java
@Transactional
public void register(RegisterRequest request) {
    if (request.getRole() != UserRole.ELDER
            && request.getRole() != UserRole.HELPER
            && request.getRole() != UserRole.BOTH) {
        throw new IllegalArgumentException("Role must be ELDER, HELPER, or BOTH");
    }
    if (userRepository.existsByUsername(request.getUsername())) {
        throw new IllegalArgumentException("Username already taken");
    }
    if (userRepository.existsByEmail(request.getEmail())) {
        throw new IllegalArgumentException("Email already registered");
    }

    // Clear any earlier unverified attempt for this email so re-registration just refreshes the link.
    pendingRepository.deleteByEmail(request.getEmail());

    String token = newVerificationToken();
    PendingRegistration pending = PendingRegistration.builder()
            .username(request.getUsername())
            .email(request.getEmail())
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .role(request.getRole().name())
            .dateOfBirth(request.getDateOfBirth())
            .token(token)
            .expiresAt(LocalDateTime.now().plusHours(24))
            .build();
    pendingRepository.save(pending);

    emailService.sendVerificationEmail(request.getEmail(),
            verifyBaseUrl + "/verify-email?token=" + token);
    postHogService.capture("pending:" + request.getEmail(), "user_signup_started",
            Map.of("role", request.getRole().name()));
}
```
*(Note: PostHog `distinct_id` uses a `pending:` prefix since there's no userId yet — adjust if your PostHogService signature differs; if unsure, drop the capture line.)*

### Task 4: verifyEmail → create the real account from pending (TDD)

- [ ] Update `backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java` to the new behavior. The verify path now reads a `PendingRegistration` and creates a `User`. Replace the test class body:
```java
@ExtendWith(MockitoExtension.class)
class AuthServiceVerifyEmailTest {

    @Mock UserRepository userRepository;
    @Mock PendingRegistrationRepository pendingRepository;
    @Mock PostHogService postHogService;
    @InjectMocks AuthService authService;

    private PendingRegistration pending(String token, LocalDateTime expiry) {
        return PendingRegistration.builder()
                .id(UUID.randomUUID())
                .username("alice").email("alice@example.com")
                .passwordHash("hash").role("ELDER")
                .token(token).expiresAt(expiry).build();
    }

    @Test
    void verifyEmail_createsUserAndDeletesPending() {
        PendingRegistration p = pending("abc", LocalDateTime.now().plusHours(1));
        when(pendingRepository.findByToken("abc")).thenReturn(Optional.of(p));
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> {
            User u = i.getArgument(0); u.setId(UUID.randomUUID()); return u;
        });

        authService.verifyEmail("abc");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().isEmailVerified()).isTrue();
        assertThat(captor.getValue().getEmail()).isEqualTo("alice@example.com");
        verify(pendingRepository).delete(p);
    }

    @Test
    void verifyEmail_rejectsUnknownToken() {
        when(pendingRepository.findByToken("nope")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> authService.verifyEmail("nope"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void verifyEmail_rejectsExpiredToken() {
        PendingRegistration p = pending("old", LocalDateTime.now().minusMinutes(1));
        when(pendingRepository.findByToken("old")).thenReturn(Optional.of(p));
        assertThatThrownBy(() -> authService.verifyEmail("old"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userRepository, never()).save(any());
    }
}
```
Add imports: `org.mockito.ArgumentCaptor`, `com.towin.common.entity.PendingRegistration`, `com.towin.common.entity.User`, `com.towin.common.repository.PendingRegistrationRepository`, `com.towin.common.service.PostHogService`.
- [ ] Run: `./mvnw test -Dtest=AuthServiceVerifyEmailTest` — expect FAIL/compile error (new behavior not implemented).
- [ ] Replace `AuthService.verifyEmail` with the create-on-verify logic:
```java
@Transactional
public void verifyEmail(String token) {
    PendingRegistration pending = pendingRepository.findByToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Invalid or expired verification link."));
    if (pending.getExpiresAt() == null || pending.getExpiresAt().isBefore(LocalDateTime.now())) {
        pendingRepository.delete(pending);
        throw new IllegalArgumentException("This verification link has expired. Please sign up again.");
    }
    // Re-check uniqueness at creation time (someone may have taken it since signup).
    if (userRepository.existsByEmail(pending.getEmail())) {
        pendingRepository.delete(pending);
        throw new IllegalArgumentException("Email already registered");
    }
    if (userRepository.existsByUsername(pending.getUsername())) {
        throw new IllegalArgumentException("Username already taken");
    }

    User user = User.builder()
            .username(pending.getUsername())
            .email(pending.getEmail())
            .passwordHash(pending.getPasswordHash())
            .role(UserRole.valueOf(pending.getRole()))
            .dateOfBirth(pending.getDateOfBirth())
            .emailVerified(true)
            .build();
    User saved = userRepository.save(user);
    pendingRepository.delete(pending);
    postHogService.capture(saved.getId().toString(), "user_signed_up",
            Map.of("role", saved.getRole().name()));
}
```
- [ ] Run: `./mvnw test -Dtest=AuthServiceVerifyEmailTest` — expect PASS.

### Task 5: resendVerification by email (public) + AuthController register returns void

- [ ] Replace `AuthService.resendVerification(UUID userId)` with an email-based version:
```java
@Transactional
public void resendVerification(String email) {
    pendingRepository.findByToken(""); // no-op guard not needed; see below
    pendingRepository.deleteByEmail(email); // remove stale, then re-create only if there was one?  -> simpler: look up first
}
```
  Actually implement it as a lookup-and-refresh (do NOT leak whether the email exists):
```java
@Transactional
public void resendVerification(String email) {
    // Anti-enumeration: always behaves the same. Only re-sends if a pending row exists.
    var existing = pendingRepository.findByEmailForResend(email);
    if (existing.isEmpty()) return;
    PendingRegistration p = existing.get();
    p.setToken(newVerificationToken());
    p.setExpiresAt(LocalDateTime.now().plusHours(24));
    pendingRepository.save(p);
    emailService.sendVerificationEmail(email, verifyBaseUrl + "/verify-email?token=" + p.getToken());
}
```
  Add to `PendingRegistrationRepository`:
```java
@org.springframework.data.jpa.repository.Query("SELECT p FROM PendingRegistration p WHERE p.email = :email")
Optional<PendingRegistration> findByEmailForResend(@org.springframework.data.repository.query.Param("email") String email);
```
  *(If two pending rows ever share an email, the unique-token + delete-on-register keeps it to one; `findByEmailForResend` returns the latest single row in practice.)*
- [ ] In `AuthController`:
  - Change `register` to return `ResponseEntity<Void>`:
```java
@PostMapping("/register")
public ResponseEntity<Void> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
    ipRateLimiter.check(http);
    authService.register(request);
    return ResponseEntity.ok().build();
}
```
  - Change `resend-verification` to public-by-email:
```java
@PostMapping("/resend-verification")
public ResponseEntity<Void> resendVerification(@Valid @RequestBody ForgotPasswordRequest request,
                                               HttpServletRequest http) {
    ipRateLimiter.check(http);
    authService.resendVerification(request.getEmail());
    return ResponseEntity.ok().build();
}
```
  *(Reuses `ForgotPasswordRequest` = `{ email }`, created in Chunk 3.)*
- [ ] Compile: `./mvnw compile -q 2>&1 | grep -v WARNING | tail` — no errors.
- [ ] Commit:
```bash
git add backend/src/main/java/com/towin/common/entity/PendingRegistration.java \
  backend/src/main/java/com/towin/common/repository/PendingRegistrationRepository.java \
  backend/src/main/resources/db/migration/V33__create_pending_registrations.sql \
  backend/src/main/java/com/towin/auth/service/AuthService.java \
  backend/src/main/java/com/towin/auth/controller/AuthController.java \
  backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java
git commit -m "feat(auth): hold manual signups in pending_registrations; create account only on verify"
```

---

## Chunk 2: Backend — Google password-free

### Task 6: Make password optional for Google onboarding

- [ ] In `auth/dto/OAuthCompleteRequest.java`, change the `password` field to optional:
```java
// was: @NotBlank @Size(min = 8, ...) private String password;
@Size(min = 8, message = "Password must be at least 8 characters")
private String password;   // optional — Google users may sign up without one
```
- [ ] In `OAuthService.complete`, only set a password when one is provided. Existing-account branch:
```java
// was: if (existing.getPasswordHash() == null) existing.setPasswordHash(encode(request.getPassword()));
if (existing.getPasswordHash() == null
        && request.getPassword() != null && !request.getPassword().isBlank()) {
    existing.setPasswordHash(passwordEncoder.encode(request.getPassword()));
}
```
  New-user branch — set hash only if provided:
```java
.passwordHash(request.getPassword() != null && !request.getPassword().isBlank()
        ? passwordEncoder.encode(request.getPassword()) : null)
```
- [ ] Compile + commit:
```bash
./mvnw compile -q 2>&1 | grep -v WARNING | tail
git add backend/src/main/java/com/towin/auth/dto/OAuthCompleteRequest.java \
  backend/src/main/java/com/towin/auth/service/OAuthService.java
git commit -m "feat(auth): make password optional for Google sign-up"
```

---

## Chunk 3: Backend — Forgot / Set password

### Task 7: DTOs + migration + entity + repo

- [ ] Create `auth/dto/ForgotPasswordRequest.java`:
```java
package com.towin.auth.dto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class ForgotPasswordRequest {
    @NotBlank @Email
    private String email;
}
```
- [ ] Create `auth/dto/ResetPasswordRequest.java`:
```java
package com.towin.auth.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
@Data
public class ResetPasswordRequest {
    @NotBlank
    private String token;
    @NotBlank @Size(min = 8, message = "Password must be at least 8 characters")
    private String newPassword;
}
```
- [ ] Create `db/migration/V34__add_password_reset.sql`:
```sql
ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP;
```
- [ ] In `User.java`, add:
```java
@Column(name = "password_reset_token")
private String passwordResetToken;

@Column(name = "password_reset_expires_at")
private LocalDateTime passwordResetExpiresAt;
```
- [ ] In `UserRepository.java`, add:
```java
Optional<User> findByPasswordResetToken(String token);
```

### Task 8: EmailService.sendPasswordResetEmail

- [ ] Add to `EmailService` (mirror `sendVerificationEmail`, different subject/body):
```java
public void sendPasswordResetEmail(String to, String resetLink) {
    if (!configured) {
        log.info("Mail not configured — password reset link for {}: {}", to, resetLink);
        return;
    }
    try {
        Map<String, Object> body = Map.of(
            "sender", Map.of("name", fromName, "email", fromEmail),
            "to", List.of(Map.of("email", to)),
            "subject", "Reset your ToWin password",
            "textContent",
                "We received a request to reset your ToWin password.\n\n" +
                "Open this link to choose a new password:\n" + resetLink + "\n\n" +
                "This link expires in 1 hour. If you didn't request this, you can ignore this email."
        );
        brevo.post().uri("/smtp/email").header("api-key", apiKey)
            .contentType(MediaType.APPLICATION_JSON).body(body)
            .retrieve().toBodilessEntity();
        log.info("Password reset email sent");
    } catch (Exception e) {
        log.error("Failed to send password reset email: {}", e.getMessage());
    }
}
```

### Task 9: AuthService forgot/reset + endpoints

- [ ] Add to `AuthService`:
```java
@Transactional
public void forgotPassword(String email) {
    // Anti-enumeration: always return normally. Only act if the account exists and has a password login.
    userRepository.findByEmail(email).ifPresent(user -> {
        String token = newVerificationToken();
        user.setPasswordResetToken(token);
        user.setPasswordResetExpiresAt(LocalDateTime.now().plusHours(1));
        userRepository.save(user);
        emailService.sendPasswordResetEmail(email, verifyBaseUrl + "/reset-password?token=" + token);
    });
}

@Transactional
public void resetPassword(String token, String newPassword) {
    User user = userRepository.findByPasswordResetToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset link."));
    if (user.getPasswordResetExpiresAt() == null
            || user.getPasswordResetExpiresAt().isBefore(LocalDateTime.now())) {
        throw new IllegalArgumentException("This reset link has expired. Request a new one.");
    }
    user.setPasswordHash(passwordEncoder.encode(newPassword));
    user.setTokenVersion(user.getTokenVersion() + 1); // invalidate existing sessions
    user.setPasswordResetToken(null);
    user.setPasswordResetExpiresAt(null);
    userRepository.save(user);
}
```
- [ ] Add to `AuthController` (both public; `/api/auth/**` is permitAll):
```java
@PostMapping("/forgot-password")
public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request,
                                           HttpServletRequest http) {
    ipRateLimiter.check(http);
    authService.forgotPassword(request.getEmail());
    return ResponseEntity.ok().build();
}

@PostMapping("/reset-password")
public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
    authService.resetPassword(request.getToken(), request.getNewPassword());
    return ResponseEntity.ok().build();
}
```
- [ ] Add a safe message so reset errors aren't generic. In `GlobalExceptionHandler` SAFE_MESSAGES static block:
```java
SAFE_MESSAGES.put("Invalid or expired reset link.", "Invalid or expired reset link.");
SAFE_MESSAGES.put("This reset link has expired.", "This reset link has expired. Request a new one.");
SAFE_MESSAGES.put("This verification link has expired.", "This verification link has expired. Please sign up again.");
SAFE_MESSAGES.put("Invalid or expired verification link.", "Invalid or expired verification link.");
```
- [ ] Compile + commit:
```bash
./mvnw compile -q 2>&1 | grep -v WARNING | tail
git add backend/src/main/java/com/towin/auth/dto/ForgotPasswordRequest.java \
  backend/src/main/java/com/towin/auth/dto/ResetPasswordRequest.java \
  backend/src/main/resources/db/migration/V34__add_password_reset.sql \
  backend/src/main/java/com/towin/common/entity/User.java \
  backend/src/main/java/com/towin/common/repository/UserRepository.java \
  backend/src/main/java/com/towin/common/service/EmailService.java \
  backend/src/main/java/com/towin/auth/service/AuthService.java \
  backend/src/main/java/com/towin/auth/controller/AuthController.java \
  backend/src/main/java/com/towin/common/exception/GlobalExceptionHandler.java
git commit -m "feat(auth): add forgot/reset password by email"
```

---

## Chunk 4: Backend — Remove the dead gate

### Task 10: Strip VERIFIED authority + matchers

- [ ] In `SecurityConfig.java`, remove the 5 verify-gate matchers (the `HttpMethod.POST/DELETE ... hasAuthority("VERIFIED")` lines for needs/connections/messages/reviews). Also remove the `.requestMatchers("/api/auth/resend-verification").authenticated()` line (resend is now public). Remove the `import org.springframework.http.HttpMethod;` if no longer used.
- [ ] In `JwtAuthFilter.java`, revert the authority list to role-only:
```java
if (Boolean.TRUE.equals(user.getIsActive())) {
    List<SimpleGrantedAuthority> authorities = role != null
            ? List.of(new SimpleGrantedAuthority(role))
            : List.of();
    UsernamePasswordAuthenticationToken auth =
            new UsernamePasswordAuthenticationToken(userId, null, authorities);
    ...
```
  (Remove the `ArrayList` + `VERIFIED` lines; the `claimedVersion`/tokenVersion check stays.)
- [ ] In `AuthService.login`, stop passing `ev` (use the 4-arg token):
```java
String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail(),
        user.getRole().name(), user.getTokenVersion());
```
  And in `guestLogin`, leave the 3-arg call as-is. (JwtUtil overloads stay; the `ev` claim simply defaults to true and is no longer read.)
- [ ] Compile + targeted tests:
```bash
./mvnw test -Dtest=AuthServiceVerifyEmailTest,AdminServiceTest 2>&1 | grep -E "Tests run|BUILD" | tail
```
  Expect all pass.
- [ ] Commit:
```bash
git add backend/src/main/java/com/towin/common/security/SecurityConfig.java \
  backend/src/main/java/com/towin/common/security/JwtAuthFilter.java \
  backend/src/main/java/com/towin/auth/service/AuthService.java
git commit -m "refactor(auth): remove now-dead email-verification gate (every account is verified)"
```

### Task 11: Boot sanity check

- [ ] `SPRING_PROFILES_ACTIVE=dev timeout 70 ./mvnw spring-boot:run -q 2>&1 | grep -Ei "Started ToWinApplication|Successfully applied|Schema-validation|ERROR" | head`
  Expect V33 + V34 applied, `Started ToWinApplication`, no schema-validation error.

---

## Chunk 5: Frontend — Manual signup → check-email; remove wall

### Task 12: CheckEmail page

- [ ] Create `frontend/src/pages/CheckEmail.jsx`: reads `email` from router state, shows "we sent a link", spam callout, a Resend button (POST `/auth/resend-verification` `{ email }`), and a link to `/login`. Style like `VerifyPending.jsx` (reuse the amber spam box). If no email in state, still render with generic copy.

### Task 13: Register → go to check-email (no login)

- [ ] In `Register.jsx` `handleSubmit`, after a successful `api.post('/auth/register', {...})`, replace `login(data.token); navigate(...)` with:
```js
await api.post('/auth/register', { username, email, password, role });
navigate('/check-email', { replace: true, state: { email } });
```
  Remove the now-unused `login`/`data` usage in that handler.

### Task 14: VerifyEmail success copy

- [ ] In `VerifyEmail.jsx`, change the success state text to: heading "✅ Email verified!", body "Your account is ready — please log in." (link to `/login` already present). Error state: "This link is invalid or expired. Please sign up again."

### Task 15: Remove the wall + add routes

- [ ] In `App.jsx`:
  - Revert `PrivateRoute`, `ElderOnly`, `PublicRoute` to remove the `needsVerify` redirects (back to the pre-wall logic).
  - Remove the `needsVerify` helper.
  - Remove the `/verify-pending` route and the `VerifyPending` import.
  - Add imports + public routes:
```jsx
import CheckEmail from './pages/CheckEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
...
<Route path="/check-email" element={<CheckEmail />} />
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```
- [ ] `npm run build` — expect success.
- [ ] Commit (from repo root):
```bash
git add frontend/src/pages/CheckEmail.jsx frontend/src/pages/VerifyEmail.jsx \
  frontend/src/pages/Register.jsx frontend/src/App.jsx
git commit -m "feat(web): manual signup shows check-email; remove verification wall"
```

---

## Chunk 6: Frontend — Google primary + FinishSetup password-free

### Task 16: Make "Sign in with Google" the primary button

- [ ] In `Login.jsx` and `Register.jsx`, restyle the `GoogleButton` to read as the **primary** action (full-width, filled brand `#4FA3CE` or a strong bordered style with the Google mark), placed **above** the username/password form, with the "or use a username" divider beneath it. Keep brand colors locked — only weight/size/position change. Add a short hint under it: "Fastest way in — no password to remember."

### Task 17: FinishSetup — remove password fields

- [ ] In `FinishSetup.jsx`:
  - Remove the `password` and `confirmPassword` state, inputs, and their validation lines.
  - Remove `password` from the `api.post('/auth/oauth/complete', {...})` body.
- [ ] `npm run build` — expect success.
- [ ] Commit:
```bash
git add frontend/src/pages/Login.jsx frontend/src/pages/Register.jsx frontend/src/pages/FinishSetup.jsx
git commit -m "feat(web): Google sign-in primary + password-free onboarding"
```

---

## Chunk 7: Frontend — Forgot / Reset password pages

### Task 18: ForgotPassword + ResetPassword pages + login link

- [ ] Create `frontend/src/pages/ForgotPassword.jsx`: an email input → `POST /auth/forgot-password { email }` → always show "If that email has an account, we've sent a reset link. Check your inbox and spam." (don't reveal existence). Style like the other auth pages.
- [ ] Create `frontend/src/pages/ResetPassword.jsx`: reads `?token=`, new-password + confirm inputs → `POST /auth/reset-password { token, newPassword }` → on success show "Password updated — please log in" (link to `/login`); on error show "invalid/expired link."
- [ ] In `Login.jsx`, add a "Forgot password?" link → `/forgot-password` near the password field.
- [ ] `npm run build` — expect success.
- [ ] Commit:
```bash
git add frontend/src/pages/ForgotPassword.jsx frontend/src/pages/ResetPassword.jsx frontend/src/pages/Login.jsx
git commit -m "feat(web): add forgot/reset password pages"
```

---

## Final Verification

- [ ] Backend: `./mvnw compile -q` clean; `./mvnw test -Dtest=AuthServiceVerifyEmailTest,AdminServiceTest` all pass.
- [ ] Frontend: `npm run build` succeeds.
- [ ] Push: `git push origin main` (Railway + Vercel auto-deploy).
- [ ] Live smoke after deploy:
  1. Manual signup → lands on **/check-email**, NOT logged in. No `users` row yet (verify via DB or by trying to log in → "Invalid credentials" until verified).
  2. Open the emailed link → "Email verified" → log in → works.
  3. Google sign-in → onboarding has **no password field** → lands in app; can also use "Forgot password" to set one later.
  4. "Forgot password" on a manual account → email → reset → log in with new password.
  5. Demo accounts (`elder@`, `helper@`) still log in and work.
- [ ] Update `docs/SECURITY-AUDIT.md` note if relevant.

## Open item to confirm with the user
- After this lands, `pages/VerifyPending.jsx` and `components/VerifyBanner.jsx` are unreferenced. Per the no-delete rule, leave them unless the user says to delete. Ask: "Delete the two orphaned files?"
