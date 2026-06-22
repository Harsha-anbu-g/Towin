# Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Critical, High, Medium, and Low security findings from the 2026-06-22 audit without touching account-deletion or password-auth flow (deferred per user instruction).

**Architecture:** Fixes span backend (Spring Boot) and frontend (React). Backend fixes touch security config, rate limiting, DTO validation, JWT token versioning, and logging. Frontend fixes remove unsafe innerHTML and add standalone legal pages. All fixes are small and isolated — grouped into 5 independent parallel batches.

**Tech Stack:** Java 21, Spring Boot 3.5, Spring Security, JJWT 0.12.3, Flyway, PostgreSQL, React + React Router

**Deferred (user must confirm first):**
- H8: DELETE /api/users/me (account self-deletion)
- L8: application-dev.yml hardcoded password
- M1: User data export endpoint
- M4: Cookie consent banner
- M5: JWT to httpOnly cookie
- M6: Email verification gate
- M11: Redis-backed rate limiter persistence

---

## Files Modified

### Backend
| File | Change |
|------|--------|
| `backend/src/main/java/com/towin/emergency/service/SosService.java` | Remove phone/OTP from log statements |
| `backend/src/main/java/com/towin/auth/controller/AuthController.java` | Add IP rate limiting to login, change-password, verify-id |
| `backend/src/main/java/com/towin/review/service/ReviewService.java` | Add participant check before saving review |
| `backend/src/main/java/com/towin/common/config/WebSocketSecurityConfig.java` | **NEW** — STOMP channel authentication |
| `backend/src/main/java/com/towin/common/security/SecurityConfig.java` | Fix CSP, add HSTS, Permissions-Policy, access-denied logging |
| `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java` | Log rejected tokens at WARN |
| `backend/src/main/java/com/towin/common/entity/User.java` | Add `tokenVersion` field |
| `backend/src/main/java/com/towin/auth/security/JwtUtil.java` | Embed tokenVersion claim; add overload |
| `backend/src/main/java/com/towin/auth/service/AuthService.java` | Increment tokenVersion on password change |
| `backend/src/main/resources/db/migration/V31__add_token_version.sql` | **NEW** — tokenVersion column |
| `backend/src/main/java/com/towin/profile/dto/PhoneUpdateRequest.java` | **NEW** — DTO with phone regex |
| `backend/src/main/java/com/towin/profile/controller/ProfileController.java` | Use PhoneUpdateRequest + @Valid for updatePhone |
| `backend/src/main/java/com/towin/auth/dto/PhoneVerifyRequest.java` | Add OTP constraints |
| `backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java` | Add @Pattern for URLs, @Size for bio/name |
| `backend/src/main/java/com/towin/profile/dto/HelperProfileRequest.java` | Add @Pattern for URLs, @Size for bio/name |
| `backend/src/main/java/com/towin/messaging/dto/MessageRequest.java` | Add @Size(max=2000) |
| `backend/src/main/java/com/towin/need/dto/NeedRequest.java` | Add @Size to title/description |
| `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java` | Add @Past to dateOfBirth |
| `backend/src/main/java/com/towin/feedback/dto/FeedbackRequest.java` | Add @Email |
| `backend/src/main/resources/application.yml` | Add Redis timeouts |
| `backend/pom.xml` | Add OWASP dependency-check plugin |

### Frontend
| File | Change |
|------|--------|
| `frontend/src/pages/ElderDashboard.jsx` | Replace `dangerouslySetInnerHTML` in TabIcon with real SVG children |
| `frontend/src/pages/HelperDashboard.jsx` | Same fix |
| `frontend/src/pages/Privacy.jsx` | **NEW** — Standalone privacy policy page |
| `frontend/src/pages/Terms.jsx` | **NEW** — Standalone terms of service page |
| `frontend/src/App.jsx` | Add `/privacy` and `/terms` routes |

---

## Chunk 1 — Backend: SosService Logs + Rate Limiting

**Files:** `SosService.java`, `AuthController.java`

### Task 1: Fix SosService — remove phone/OTP from logs

- [ ] Open `backend/src/main/java/com/towin/emergency/service/SosService.java`
- [ ] Replace line 50 (in `sendSmsPublic`):
  ```java
  // BEFORE:
  log.info("Twilio not configured — would send SMS to {}: {}", toNumber, body);
  // AFTER:
  log.info("Twilio not configured — SMS suppressed (dev mode)");
  ```
- [ ] Replace line 60 (success log in `sendSmsPublic`):
  ```java
  // BEFORE:
  log.info("SMS sent to {}", toNumber);
  // AFTER:
  log.info("SMS sent successfully");
  ```
- [ ] Replace line 62 (error log in `sendSmsPublic`):
  ```java
  // BEFORE:
  log.error("Failed to send OTP SMS to {}: {}", toNumber, e.getMessage());
  // AFTER:
  log.error("Failed to send OTP SMS: {}", e.getMessage());
  ```
- [ ] Replace line 75 (in private `sendSms`):
  ```java
  // BEFORE:
  log.info("Twilio not configured — would send SMS to {}: {}", toNumber, body);
  // AFTER:
  log.info("Twilio not configured — SMS suppressed (dev mode)");
  ```
- [ ] Replace line 85 (success log in private `sendSms`):
  ```java
  // BEFORE:
  log.info("SMS sent to {}", toNumber);
  // AFTER:
  log.info("SMS sent successfully");
  ```
- [ ] Replace line 87 (error log in private `sendSms`):
  ```java
  // BEFORE:
  log.error("Failed to send SMS to {}: {}", toNumber, e.getMessage());
  // AFTER:
  log.error("Failed to send SMS: {}", e.getMessage());
  ```

### Task 2: Add IP rate limiting to login, change-password, verify-id

- [ ] Open `backend/src/main/java/com/towin/auth/controller/AuthController.java`
- [ ] The `login` method at line 32 currently has no `HttpServletRequest` parameter and no IP check. Change it:
  ```java
  // BEFORE:
  @PostMapping("/login")
  public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
      return ResponseEntity.ok(authService.login(request));
  }
  // AFTER:
  @PostMapping("/login")
  public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                            HttpServletRequest http) {
      ipRateLimiter.check(http);
      return ResponseEntity.ok(authService.login(request));
  }
  ```
- [ ] The `changePassword` method at line 43 needs an IP check:
  ```java
  // BEFORE:
  @PostMapping("/change-password")
  public ResponseEntity<Void> changePassword(
          Authentication auth,
          @Valid @RequestBody ChangePasswordRequest request) {
      UUID userId = UUID.fromString(auth.getName());
      authService.changePassword(userId, request);
      return ResponseEntity.ok().build();
  }
  // AFTER:
  @PostMapping("/change-password")
  public ResponseEntity<Void> changePassword(
          Authentication auth,
          @Valid @RequestBody ChangePasswordRequest request,
          HttpServletRequest http) {
      ipRateLimiter.check(http);
      UUID userId = UUID.fromString(auth.getName());
      authService.changePassword(userId, request);
      return ResponseEntity.ok().build();
  }
  ```
- [ ] The `verifyId` method at line 52 needs an IP check:
  ```java
  // BEFORE:
  @PostMapping("/verify-id")
  public ResponseEntity<VerifyIdResponse> verifyId(
          Authentication auth,
          @RequestParam("file") MultipartFile file) {
      UUID userId = UUID.fromString(auth.getName());
      return ResponseEntity.ok(authService.verifyId(userId, file));
  }
  // AFTER:
  @PostMapping("/verify-id")
  public ResponseEntity<VerifyIdResponse> verifyId(
          Authentication auth,
          @RequestParam("file") MultipartFile file,
          HttpServletRequest http) {
      ipRateLimiter.check(http);
      UUID userId = UUID.fromString(auth.getName());
      return ResponseEntity.ok(authService.verifyId(userId, file));
  }
  ```
- [ ] Verify `import jakarta.servlet.http.HttpServletRequest;` is already at the top (it is — line 9 in AuthController imports it)
- [ ] Build: `cd backend && ./mvnw compile -q`
- [ ] Commit: `git add backend/src/main/java/com/towin/emergency/service/SosService.java backend/src/main/java/com/towin/auth/controller/AuthController.java && git commit -m "security: remove phone/OTP from logs, add IP rate limit to login and auth endpoints"`

---

## Chunk 2 — Backend: ReviewService Participant Check + WebSocket Auth

**Files:** `ReviewService.java`, `WebSocketSecurityConfig.java` (new)

### Task 3: Fix broken authorization in ReviewService

The vulnerability: any authenticated user can submit a review against any other user, even if they never interacted. The fix is: when a `needId` is provided, verify the reviewer is either the elder who posted the need OR the accepted helper on that need.

- [ ] Open `backend/src/main/java/com/towin/review/service/ReviewService.java`
- [ ] The class already injects `NeedRepository`. Add `NeedApplicationRepository` to the constructor field list (it's already available in the project):
  ```java
  // Add field after the existing fields (after line 31):
  private final NeedApplicationRepository needApplicationRepository;
  ```
  (Also add `import com.towin.need.repository.NeedApplicationRepository;` to the imports)
- [ ] In `submitReview()`, after the need is loaded (after line 50), add the participant check:
  ```java
  // Add after: need = needRepository.findById(...).orElseThrow(...)
  // Verify reviewer was actually involved in this need
  boolean isElder = need.getElder().getId().equals(reviewerId);
  boolean isHelper = needApplicationRepository.existsByNeedIdAndHelperId(need.getId(), reviewerId);
  if (!isElder && !isHelper) {
      throw new IllegalArgumentException("You can only review users from needs you participated in");
  }
  ```
- [ ] When `needId` is null, leave the existing behavior (allow trust-journey-based reviews — those are gated by connection, handled by UI)
- [ ] Build: `cd backend && ./mvnw compile -q`
- [ ] Commit: `git add backend/src/main/java/com/towin/review/service/ReviewService.java && git commit -m "security(H1): require reviewer to be a participant in the referenced need"`

### Task 4: WebSocket STOMP channel authentication

The vulnerability: any unauthenticated client can open a WebSocket and subscribe to broker topics.

- [ ] Create new file `backend/src/main/java/com/towin/common/config/WebSocketSecurityConfig.java`:
  ```java
  package com.towin.common.config;

  import org.springframework.context.annotation.Bean;
  import org.springframework.context.annotation.Configuration;
  import org.springframework.messaging.Message;
  import org.springframework.messaging.MessageChannel;
  import org.springframework.messaging.simp.SimpMessageType;
  import org.springframework.messaging.simp.stomp.StompCommand;
  import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
  import org.springframework.messaging.support.ChannelInterceptor;
  import org.springframework.security.authorization.AuthorizationDecision;
  import org.springframework.security.authorization.AuthorizationManager;
  import org.springframework.security.config.annotation.web.socket.EnableWebSocketSecurity;
  import org.springframework.security.messaging.access.intercept.MessageMatcherDelegatingAuthorizationManager;

  @Configuration
  @EnableWebSocketSecurity
  public class WebSocketSecurityConfig {

      @Bean
      AuthorizationManager<Message<?>> messageAuthorizationManager(
              MessageMatcherDelegatingAuthorizationManager.Builder messages) {
          messages
              .simpTypeMatchers(SimpMessageType.CONNECT,
                                SimpMessageType.HEARTBEAT,
                                SimpMessageType.UNSUBSCRIBE,
                                SimpMessageType.DISCONNECT).permitAll()
              .simpSubscribeDestMatchers("/user/**", "/topic/**", "/queue/**").authenticated()
              .anyMessage().authenticated();
          return messages.build();
      }
  }
  ```
- [ ] Build: `cd backend && ./mvnw compile -q`
- [ ] Commit: `git add backend/src/main/java/com/towin/common/config/WebSocketSecurityConfig.java && git commit -m "security(H3): add STOMP channel authentication for WebSocket connections"`

---

## Chunk 3 — Backend: SecurityConfig Headers + Auth Logging

**Files:** `SecurityConfig.java`, `JwtAuthFilter.java`

### Task 5: Fix CSP, add HSTS and Permissions-Policy

- [ ] Open `backend/src/main/java/com/towin/common/security/SecurityConfig.java`
- [ ] Replace the `.headers(...)` block (lines 46-54):
  ```java
  .headers(headers -> headers
      .frameOptions(frame -> frame.deny())
      .contentTypeOptions(ct -> {})
      .referrerPolicy(rp -> rp.policy(
          org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
      .httpStrictTransportSecurity(hsts -> hsts
          .includeSubDomains(true)
          .maxAgeInSeconds(31536000))
      .contentSecurityPolicy(csp -> csp
          .policyDirectives(
              "default-src 'self'; " +
              "img-src 'self' https://*.amazonaws.com data: blob:; " +
              "connect-src 'self' wss: https://accounts.google.com https://*.amazonaws.com; " +
              "style-src 'self' 'unsafe-inline'; " +
              "font-src 'self' data:; " +
              "frame-ancestors 'none'"
          )
      )
  )
  ```
- [ ] Add a Permissions-Policy header by adding a custom writer. After the `.addFilterBefore(jwtAuthFilter, ...)` line, add a response header filter bean:
  ```java
  // Add this new @Bean to SecurityConfig:
  @Bean
  public jakarta.servlet.Filter permissionsPolicyFilter() {
      return (request, response, chain) -> {
          ((jakarta.servlet.http.HttpServletResponse) response)
              .setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
          chain.doFilter(request, response);
      };
  }
  ```
  And register it in `filterChain` before the return:
  ```java
  http.addFilterAfter(permissionsPolicyFilter(), UsernamePasswordAuthenticationFilter.class);
  ```
- [ ] Add `exceptionHandling` for logging 401/403 (add before the `.addFilterBefore` line):
  ```java
  .exceptionHandling(ex -> ex
      .authenticationEntryPoint((request, response, authException) -> {
          org.slf4j.LoggerFactory.getLogger(SecurityConfig.class)
              .warn("401 Unauthorized: {} {}", request.getMethod(), request.getRequestURI());
          response.sendError(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
      })
      .accessDeniedHandler((request, response, accessDeniedException) -> {
          org.slf4j.LoggerFactory.getLogger(SecurityConfig.class)
              .warn("403 Forbidden: {} {}", request.getMethod(), request.getRequestURI());
          response.sendError(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
      })
  )
  ```
- [ ] Build: `cd backend && ./mvnw compile -q`

### Task 6: Log rejected JWT tokens in JwtAuthFilter

- [ ] Open `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java`
- [ ] Add `@Slf4j` or a logger field. The class currently uses no logger. Add at class level:
  ```java
  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(JwtAuthFilter.class);
  ```
- [ ] Replace the silent `catch` block (line 62):
  ```java
  // BEFORE:
  } catch (JwtException | IllegalArgumentException ignored) {
      // invalid token — leave security context empty
  }
  // AFTER:
  } catch (JwtException | IllegalArgumentException e) {
      log.warn("Rejected invalid JWT on {} {}: {}", request.getMethod(), request.getRequestURI(), e.getMessage());
  }
  ```
- [ ] Build: `cd backend && ./mvnw compile -q`
- [ ] Commit: `git add backend/src/main/java/com/towin/common/security/SecurityConfig.java backend/src/main/java/com/towin/common/security/JwtAuthFilter.java && git commit -m "security(H5/M9/L2/L9): fix CSP, add HSTS, Permissions-Policy, log 401/403 and rejected JWTs"`

---

## Chunk 4 — Backend: Token Revocation on Password Change

**Files:** `V31__add_token_version.sql` (new), `User.java`, `JwtUtil.java`, `AuthService.java`, `JwtAuthFilter.java`

### Task 7: Add tokenVersion column via migration

- [ ] Create `backend/src/main/resources/db/migration/V31__add_token_version.sql`:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
  ```

### Task 8: Add tokenVersion field to User entity

- [ ] Open `backend/src/main/java/com/towin/common/entity/User.java`
- [ ] Add after the `updatedAt` field (around line 104):
  ```java
  @Column(name = "token_version")
  @Builder.Default
  private int tokenVersion = 0;
  ```

### Task 9: Embed tokenVersion in JWT and validate it on every request

- [ ] Open `backend/src/main/java/com/towin/auth/security/JwtUtil.java`
- [ ] Add an overloaded `generateToken` that accepts `tokenVersion`:
  ```java
  public String generateToken(String userId, String email, String role, int tokenVersion) {
      return Jwts.builder()
              .subject(userId)
              .claim("email", email)
              .claim("role", role)
              .claim("tv", tokenVersion)
              .issuedAt(new Date())
              .expiration(new Date(System.currentTimeMillis() + expirationMs))
              .signWith(key)
              .compact();
  }
  ```
- [ ] Keep the existing 3-arg `generateToken` (it's used by guest/register where version is always 0):
  ```java
  public String generateToken(String userId, String email, String role) {
      return generateToken(userId, email, role, 0);
  }
  ```
- [ ] Add a helper to extract the version claim:
  ```java
  public int extractTokenVersion(String token) {
      try {
          Integer tv = parseClaims(token).get("tv", Integer.class);
          return tv != null ? tv : 0;
      } catch (JwtException | IllegalArgumentException e) {
          return -1;
      }
  }
  ```

### Task 10: Increment tokenVersion on password change

- [ ] Open `backend/src/main/java/com/towin/auth/service/AuthService.java`
- [ ] In `changePassword()` (line 125), after setting the new password hash:
  ```java
  user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
  user.setTokenVersion(user.getTokenVersion() + 1);   // ← add this line
  userRepository.save(user);
  ```
- [ ] In `login()` (line 105), use the versioned token:
  ```java
  // BEFORE:
  String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail(), user.getRole().name());
  // AFTER:
  String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail(), user.getRole().name(), user.getTokenVersion());
  ```

### Task 11: Validate tokenVersion in JwtAuthFilter on every request

- [ ] Open `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java`
- [ ] Inside the `userRepository.findById(UUID.fromString(userId)).ifPresent(user -> {` block, add the version check before setting the authentication:
  ```java
  userRepository.findById(UUID.fromString(userId)).ifPresent(user -> {
      // Verify the token's version matches the DB — invalidates tokens issued before a password change
      int tokenVersion = jwtUtil.extractTokenVersion(token);
      if (tokenVersion != user.getTokenVersion()) {
          log.warn("Token version mismatch for user {} — token invalidated", userId);
          return;
      }
      if (Boolean.TRUE.equals(user.getIsActive())) {
          // ... existing auth code ...
      }
  });
  ```
- [ ] Build: `cd backend && ./mvnw compile -q`
- [ ] Run tests: `cd backend && ./mvnw test -q 2>&1 | tail -20`
- [ ] Commit: `git add backend/src/main/resources/db/migration/V31__add_token_version.sql backend/src/main/java/com/towin/common/entity/User.java backend/src/main/java/com/towin/auth/security/JwtUtil.java backend/src/main/java/com/towin/auth/service/AuthService.java backend/src/main/java/com/towin/common/security/JwtAuthFilter.java && git commit -m "security(H2): invalidate JWT tokens on password change via tokenVersion"`

---

## Chunk 5 — Backend: DTO Validation Fixes

**Files:** Multiple DTO files + ProfileController

### Task 12: PhoneUpdateRequest DTO

- [ ] Create `backend/src/main/java/com/towin/profile/dto/PhoneUpdateRequest.java`:
  ```java
  package com.towin.profile.dto;

  import jakarta.validation.constraints.NotBlank;
  import jakarta.validation.constraints.Pattern;
  import lombok.Data;

  @Data
  public class PhoneUpdateRequest {
      @NotBlank
      @Pattern(regexp = "^\\+?[1-9]\\d{6,14}$", message = "Invalid phone number format")
      private String phone;
  }
  ```
- [ ] Open `backend/src/main/java/com/towin/profile/controller/ProfileController.java`
- [ ] Replace the `updatePhone` method (lines 53-59):
  ```java
  @PutMapping("/phone")
  public ResponseEntity<ProfileResponse> updatePhone(
          Authentication auth,
          @Valid @RequestBody PhoneUpdateRequest request) {
      UUID userId = UUID.fromString(auth.getName());
      return ResponseEntity.ok(profileService.updatePhone(userId, request.getPhone()));
  }
  ```
- [ ] Add `import com.towin.profile.dto.PhoneUpdateRequest;` to imports (remove `import java.util.Map;` if no longer used — check other methods first; `updateLocation` still uses Map so keep it)

### Task 13: PhoneVerifyRequest — add OTP constraints

- [ ] Open `backend/src/main/java/com/towin/auth/dto/PhoneVerifyRequest.java`
- [ ] Replace entirely:
  ```java
  package com.towin.auth.dto;

  import jakarta.validation.constraints.NotBlank;
  import jakarta.validation.constraints.Pattern;
  import lombok.Data;

  @Data
  public class PhoneVerifyRequest {
      @NotBlank
      @Pattern(regexp = "^[0-9]{6}$", message = "OTP must be a 6-digit number")
      private String otp;
  }
  ```
- [ ] Open `backend/src/main/java/com/towin/auth/controller/AuthController.java`
- [ ] Add `@Valid` to the `confirmPhoneOtp` method parameter (line 70):
  ```java
  // BEFORE:
  @RequestBody PhoneVerifyRequest request
  // AFTER:
  @Valid @RequestBody PhoneVerifyRequest request
  ```

### Task 14: ElderProfileRequest — URL validation and size limits

- [ ] Open `backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java`
- [ ] Add `@Size` to `name` field:
  ```java
  @NotBlank
  @Size(max = 100)
  private String name;
  ```
- [ ] Add `@Size` to `bio` field:
  ```java
  @Size(max = 1000)
  private String bio;
  ```
- [ ] Add `@Pattern` to `facebookUrl`:
  ```java
  @Pattern(regexp = "^(https://.*)?$", message = "Must be a valid HTTPS URL or empty")
  private String facebookUrl;
  ```
- [ ] Add `@Pattern` to `instagramUrl`:
  ```java
  @Pattern(regexp = "^(https://.*)?$", message = "Must be a valid HTTPS URL or empty")
  private String instagramUrl;
  ```
- [ ] Add `import jakarta.validation.constraints.Size;` to imports

### Task 15: HelperProfileRequest — same fixes

- [ ] Open `backend/src/main/java/com/towin/profile/dto/HelperProfileRequest.java`
- [ ] Apply the exact same changes as Task 14:
  - `@Size(max = 100)` on `name`
  - `@Size(max = 1000)` on `bio`
  - `@Pattern(regexp = "^(https://.*)?$")` on `facebookUrl`
  - `@Pattern(regexp = "^(https://.*)?$")` on `instagramUrl`

### Task 16: MessageRequest, NeedRequest, RegisterRequest, FeedbackRequest

- [ ] Open `backend/src/main/java/com/towin/messaging/dto/MessageRequest.java` — add `@Size(max = 2000)` to `content`:
  ```java
  @NotBlank
  @Size(max = 2000)
  private String content;
  ```
- [ ] Open `backend/src/main/java/com/towin/need/dto/NeedRequest.java` — add size constraints:
  ```java
  @NotBlank
  @Size(max = 200)
  private String title;
  // and:
  @Size(max = 2000)
  private String description;
  ```
- [ ] Open `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java` — add `@Past` to `dateOfBirth`:
  ```java
  @Past(message = "Date of birth must be in the past")
  private LocalDate dateOfBirth;
  ```
  Add `import jakarta.validation.constraints.Past;`
- [ ] Open `backend/src/main/java/com/towin/feedback/dto/FeedbackRequest.java` — add `@Email` to `email`:
  ```java
  @Email
  private String email;
  ```
  Add `import jakarta.validation.constraints.Email;`
- [ ] Build: `cd backend && ./mvnw compile -q`
- [ ] Commit: `git add backend/src/main/java/com/towin/profile/dto/ backend/src/main/java/com/towin/profile/controller/ProfileController.java backend/src/main/java/com/towin/auth/dto/PhoneVerifyRequest.java backend/src/main/java/com/towin/auth/controller/AuthController.java backend/src/main/java/com/towin/messaging/dto/MessageRequest.java backend/src/main/java/com/towin/need/dto/NeedRequest.java backend/src/main/java/com/towin/auth/dto/RegisterRequest.java backend/src/main/java/com/towin/feedback/dto/FeedbackRequest.java && git commit -m "security(H6/L3/L4/L6/L7/M10): add DTO validation — phone format, OTP pattern, size limits, URL validation, email format"`

---

## Chunk 6 — Backend: Config & Build

**Files:** `application.yml`, `pom.xml`

### Task 17: Add Redis timeouts to application.yml

- [ ] Open `backend/src/main/resources/application.yml`
- [ ] Find the `spring.data.redis` section (around line 23-27) and add timeout config:
  ```yaml
  spring:
    data:
      redis:
        host: ${REDIS_HOST:localhost}
        port: ${REDIS_PORT:6379}
        password: ${REDIS_PASSWORD:}
        timeout: 2000ms
        connect-timeout: 1000ms
  ```

### Task 18: Add OWASP dependency-check to pom.xml

- [ ] Open `backend/pom.xml`
- [ ] Find the `<build><plugins>` section and add:
  ```xml
  <plugin>
      <groupId>org.owasp</groupId>
      <artifactId>dependency-check-maven</artifactId>
      <version>9.2.0</version>
      <configuration>
          <failBuildOnCVSS>9</failBuildOnCVSS>
          <skipTestScope>true</skipTestScope>
      </configuration>
  </plugin>
  ```
- [ ] Commit: `git add backend/src/main/resources/application.yml backend/pom.xml && git commit -m "security(M12/L10): add Redis timeouts and OWASP dependency-check plugin"`

---

## Chunk 7 — Frontend: Remove dangerouslySetInnerHTML

**Files:** `ElderDashboard.jsx`, `HelperDashboard.jsx`

### Task 19: Fix ElderDashboard TabIcon

- [ ] Open `frontend/src/pages/ElderDashboard.jsx`
- [ ] The `TabIcon` component (lines 122-126) currently uses `dangerouslySetInnerHTML`. Replace the entire `TAB_ICONS` constant and `TabIcon` function:
  ```jsx
  function TabIcon({ id, active }) {
    const color = active ? '#fff' : '#5a6470';
    const style = { flexShrink: 0 };
    const svgProps = {
      width: 16, height: 16,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth: '2.1',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      style,
    };
    if (id === 'connections') return (
      <svg {...svgProps}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    );
    if (id === 'discover') return (
      <svg {...svgProps}>
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    );
    if (id === 'needs' || id === 'browse') return (
      <svg {...svgProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    );
    return null;
  }
  ```
- [ ] Delete the now-unused `TAB_ICONS` constant (lines 116-121)

### Task 20: Fix HelperDashboard TabIcon

- [ ] Open `frontend/src/pages/HelperDashboard.jsx`
- [ ] Apply the same replacement to `TabIcon` (lines 109-113), keeping the same SVG paths. HelperDashboard has only 3 tabs: `connections`, `discover`, `browse` — same paths as above.
- [ ] Delete the `TAB_ICONS` constant
- [ ] Commit: `git add frontend/src/pages/ElderDashboard.jsx frontend/src/pages/HelperDashboard.jsx && git commit -m "security(L1): replace dangerouslySetInnerHTML with real SVG elements in dashboard tab icons"`

---

## Chunk 8 — Frontend: Privacy & Terms Standalone Pages

**Files:** `Privacy.jsx` (new), `Terms.jsx` (new), `App.jsx`

### Task 21: Create Privacy page

- [ ] Create `frontend/src/pages/Privacy.jsx`:
  ```jsx
  import { useNavigate } from 'react-router-dom';

  export default function Privacy() {
    const navigate = useNavigate();
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'inherit', color: '#2d3748', lineHeight: 1.7 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#4FA3CE', cursor: 'pointer', fontSize: 14, marginBottom: 32, padding: 0 }}>
          ← Back
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: '#718096', fontSize: 14, marginBottom: 32 }}>Last updated: June 2026</p>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>What we collect</h2>
          <p>ToWin collects the information you provide when you create an account (username, date of birth, role), information you add to your profile (name, bio, photo, phone number), and messages you exchange with other users. We also collect your device's approximate location when you choose to share it.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>How we use your data</h2>
          <p>Your data is used to connect elders with helpers, calculate your trust score, send emergency alerts to your nominated contacts, and improve the platform. We do not sell your data to third parties.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Your rights</h2>
          <p>You have the right to access, correct, or request deletion of your personal data. You can update your profile at any time from the app. To request a full export of your data or account deletion, email <a href="mailto:privacy@towin.app" style={{ color: '#4FA3CE' }}>privacy@towin.app</a>.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Data storage</h2>
          <p>Your data is stored on servers in the United States. Profile photos and identity documents are stored in Amazon S3. We retain your data for as long as your account is active. If you delete your account, all personal data is removed within 30 days.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Contact</h2>
          <p>For privacy questions or data requests, contact us at <a href="mailto:privacy@towin.app" style={{ color: '#4FA3CE' }}>privacy@towin.app</a>.</p>
        </section>
      </div>
    );
  }
  ```

### Task 22: Create Terms page

- [ ] Create `frontend/src/pages/Terms.jsx`:
  ```jsx
  import { useNavigate } from 'react-router-dom';

  export default function Terms() {
    const navigate = useNavigate();
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'inherit', color: '#2d3748', lineHeight: 1.7 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#4FA3CE', cursor: 'pointer', fontSize: 14, marginBottom: 32, padding: 0 }}>
          ← Back
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: '#718096', fontSize: 14, marginBottom: 32 }}>Last updated: June 2026</p>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Who can use ToWin</h2>
          <p>ToWin is open to adults aged 18 and over. Elders using the platform must be at least 55 years old. By creating an account you confirm that you meet these requirements and that the information you provide is accurate.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>How it works</h2>
          <p>ToWin connects elderly users with helpers for everyday tasks and companionship. All connections and interactions on the platform are subject to our community guidelines. Users are responsible for their own safety when meeting in person.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>What you must not do</h2>
          <p>You must not use ToWin to harass, deceive, or harm other users. You must not impersonate another person, create fake accounts, or use the platform for commercial solicitation. Violations may result in account suspension.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Liability</h2>
          <p>ToWin is a platform for connecting people and is not responsible for the actions of its users. We do not guarantee the accuracy of any user-provided information. Use of the platform is at your own risk.</p>
        </section>

        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Contact</h2>
          <p>Questions about these terms? Email <a href="mailto:support@towin.app" style={{ color: '#4FA3CE' }}>support@towin.app</a>.</p>
        </section>
      </div>
    );
  }
  ```

### Task 23: Add routes to App.jsx

- [ ] Open `frontend/src/App.jsx`
- [ ] Add imports near the top with the other page imports:
  ```jsx
  import Privacy from './pages/Privacy';
  import Terms from './pages/Terms';
  ```
- [ ] Add routes inside the `<Routes>` block (add as public routes, before the catch-all):
  ```jsx
  <Route path="/privacy" element={<Privacy />} />
  <Route path="/terms" element={<Terms />} />
  ```
- [ ] Commit: `git add frontend/src/pages/Privacy.jsx frontend/src/pages/Terms.jsx frontend/src/App.jsx && git commit -m "security(M2/M3): add standalone /privacy and /terms routes with real legal content"`

---

## Final Verification

- [ ] Build backend: `cd backend && ./mvnw compile -q`
- [ ] Run all tests: `cd backend && ./mvnw test 2>&1 | tail -30`
- [ ] Verify the app starts: `cd backend && ./mvnw spring-boot:run -q &` (stop after confirming startup)
- [ ] Push to main: `git push origin main`
- [ ] Update `docs/SECURITY-AUDIT.md` — mark fixed items with ✅ in the report
