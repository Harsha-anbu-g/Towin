# ToWin — Full Security Audit Report

**Date:** 2026-06-22  
**Scope:** Full codebase — backend (Spring Boot), frontend (React), infrastructure config  
**Method:** 4-domain parallel automated audit (Authorization, Input Validation, Secrets/Logging/Rate-Limiting, Legal/Frontend)

---

## Quick Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2 | ❌ Must fix before launch |
| HIGH | 8 | ❌ Must fix before launch |
| MEDIUM | 12 | ⚠️ Fix before public users |
| LOW | 10 | 🔶 Fix in next sprint |
| PASS | 16 | ✅ Already implemented correctly |

---

## CRITICAL Findings

### C1 — Live credentials in `.env` file on disk
**File:** `.env` (project root)  
**Risk:** The file contains real, unrevoked production credentials:
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` — live Twilio credentials
- `AWS_ACCESS_KEY` + `AWS_SECRET_KEY` — live AWS IAM credentials with S3 access
- `JWT_SECRET=towin-secret-key-change-in-production-must-be-long-enough-256bits` — dev JWT secret; if Railway uses this same value, every JWT is forgeable

The file is in `.gitignore` and has never been committed. However, the JWT secret value is clearly a placeholder meant to be replaced — verify that Railway's `JWT_SECRET` env var is a cryptographically random 256-bit value, not this string.

**Action:** Rotate Twilio credentials and AWS IAM keys immediately. Generate a new random JWT secret for production. Store them only in Railway's environment variable dashboard.

---

### C2 — OTP plaintext logged when Twilio is not configured
**File:** `backend/src/main/java/com/towin/SosService.java:50`  
**Code:**
```java
log.info("Twilio not configured — would send SMS to {}: {}", toNumber, body);
```
When `TWILIO_ACCOUNT_SID` is absent (dev mode), the full OTP code and the user's phone number are written to the application log together. In any shared dev/staging environment where logs are captured (Railway log drain, Datadog, etc.), this constitutes PII + secret exposure.

**Action:** Replace with `log.info("Twilio not configured — OTP generated for user (not sent)")`. Never log OTP values.

---

## HIGH Findings

### H1 — Broken authorization: any user can review any other user
**File:** `backend/src/main/java/com/towin/review/service/ReviewService.java:34-66`  
**Risk:** `submitReview()` only checks that `reviewerId != revieweeId` and that no duplicate review exists for the same `needId`. There is no check that the reviewer was actually a participant in the referenced need or connection. Any authenticated user can post a review against any other user, attaching any `needId`.

**Action:** Before saving, verify `needApplicationRepository.existsByNeedIdAndHelperId(needId, reviewerId)` (or equivalent) to confirm the reviewer participated in that need.

---

### H2 — No token revocation on logout or password change
**Files:** No logout endpoint exists; `AuthService.java:125` (changePassword)  
**Risk:** There is no `POST /api/auth/logout` endpoint, no token blacklist, and no Redis-backed revocation store. When a user changes their password, existing JWT tokens remain valid for up to 24 hours. If a token is stolen, the victim changing their password provides no protection.

The only partial mitigation: `JwtAuthFilter.java:46` checks `user.getIsActive()` on every request, so a suspended account is blocked even with a valid token.

**Action:** Store a `tokenVersion` (integer) on the User entity. Increment it on password change and on explicit logout. Embed the version in the JWT claim. Reject tokens whose embedded version doesn't match the DB value.

---

### H3 — WebSocket connections are completely unauthenticated
**Files:** `SecurityConfig.java:61`, `WebSocketConfig.java`  
**Code:**
```java
.requestMatchers("/ws/**").permitAll()
```
There is no `WebSocketSecurityConfig` (no class extending `AbstractSecurityWebSocketMessageBrokerConfigurer`). Spring Security's HTTP rules do not apply to STOMP frames after the upgrade. Any unauthenticated client can open a WebSocket connection and subscribe to broker destinations (`/topic/*`, `/queue/*`), potentially receiving push notifications intended for other users.

**Action:** Create a `WebSocketSecurityConfig` class and add:
```java
@Override
protected void configureInbound(MessageSecurityMetadataSourceRegistry messages) {
    messages.anyMessage().authenticated();
}
```
Also add a `ChannelInterceptor` to extract and validate the JWT from the STOMP CONNECT frame's `Authorization` header.

---

### H4 — No IP-based rate limiting on `POST /api/auth/login`
**File:** `AuthController.java:32`  
**Risk:** `LoginRateLimiter` is keyed by login identifier (email/username/phone). An attacker who doesn't know any account names can hammer the login endpoint from one IP with random credentials indefinitely — the IP is never checked on `/login`. Only `/register` and `/guest` have IP-rate limiting via `IpRateLimiter`.

**Action:** Apply `ipRateLimiter.check(request)` at the top of the login handler, the same way it is applied to register.

---

### H5 — No logging of 401/403 authorization failures
**Files:** `JwtAuthFilter.java:62`, `SecurityConfig.java`  
**Risk:** `JwtException` is silently swallowed in the filter chain. No `accessDeniedHandler` is configured. Zero visibility into rejected tokens, expired sessions, or authorization failures in production — making it impossible to detect an ongoing attack.

**Action:** Add an `AuthenticationEntryPoint` and `AccessDeniedHandler` to `SecurityConfig` that log the IP, user ID (if extractable), and endpoint at WARN level. Also log caught `JwtException` in `JwtAuthFilter`.

---

### H6 — Phone field accepts any raw string into the database
**Files:** `ProfileController.java:56`, `ProfileService.java:108`  
**Code:**
```java
@PutMapping("/phone")
public ResponseEntity<?> updatePhone(@RequestBody Map<String, String> body, ...) {
    profileService.updatePhone(userId, body.get("phone"));
}
```
The phone value from the request body is passed directly to the DB with no format, length, or pattern check at any layer (no `@Valid`, no regex, no service-level check).

**Action:** Create a `PhoneUpdateRequest` DTO with `@NotBlank @Pattern(regexp = "^\\+?[1-9]\\d{6,14}$") String phone` and add `@Valid` to the controller.

---

### H7 — JWT secret in `.env` may be too guessable
**File:** `.env`, `application.yml:56`  
**Risk:** The local `.env` JWT secret is `towin-secret-key-change-in-production-must-be-long-enough-256bits` — a human-readable string. `JwtUtil.java:26-27` validates minimum 32 characters at startup, but this string is 62 characters of low-entropy ASCII. If Railway was ever configured by copying from this file, production tokens are forgeable.

**Action:** Generate a production JWT secret with: `openssl rand -base64 64`. Set it in Railway's environment variables. Never copy from `.env`.

---

### H8 — No self-service account deletion (GDPR Art. 17)
**Files:** No `DELETE /api/users/me` exists anywhere  
**Risk:** Regular users cannot delete their own account. `AdminService.deleteUser()` (lines 109-139) correctly cascades all data, but it's gated behind `ADMIN` role. The Privacy Policy modal (Register.jsx:43) promises users can request deletion by emailing `support@towin.example` — a fake domain.

**Action:** Expose a `DELETE /api/users/me` endpoint that calls the same cascade logic as `AdminService.deleteUser()` but scoped to the authenticated user's own ID. Require password re-confirmation before executing.

---

## MEDIUM Findings

### M1 — No user data export endpoint (GDPR Art. 15)
**Risk:** Users have a legal right to download all data held about them. No such endpoint exists. The Privacy Policy promises it by email (`support@towin.example` — fake domain).

**Action:** Implement `GET /api/users/me/export` that returns a JSON object containing the user's profile, needs, messages, reviews, connections, and trust logs.

---

### M2 — Privacy Policy and Terms of Service are modals, not pages
**File:** `frontend/src/pages/Register.jsx:704-707`  
**Risk:** Legal docs are only accessible as modals on the registration screen. They cannot be linked to from app stores, support emails, or anywhere post-login. Apple and Google require a standalone URL for the Privacy Policy.

**Action:** Create `/privacy` and `/terms` routes with standalone pages. Link them in the app footer and the registration modal.

---

### M3 — Legal docs contain placeholder text and fake domains
**Files:** `Register.jsx:10` (Terms: "This is a placeholder document for the prototype"), `Register.jsx:43` (Privacy: `support@towin.example`)  
**Risk:** Placeholder text is currently visible to real users. The fake contact email means legal data requests go nowhere.

**Action:** Replace placeholder text with real, counsel-reviewed content. Replace `towin.example` with the real domain email.

---

### M4 — No cookie consent / GDPR banner
**Risk:** The app writes to `localStorage` (`AuthContext.jsx:15,32`) and `sessionStorage` without asking for consent. Under GDPR and ePrivacy Directive, non-essential storage requires prior consent in the EU. No consent banner exists anywhere in the frontend.

**Action:** Add a consent banner (or use a CMP library) that fires before any storage writes occur for EU users. At minimum, the JWT storage could be justified as "strictly necessary" if documented as such in the Privacy Policy.

---

### M5 — JWT stored in localStorage (XSS-accessible)
**Files:** `frontend/src/context/AuthContext.jsx:15,32`, `frontend/src/api/axios.js:8`  
**Risk:** Any JavaScript executing on the page (injected ads, compromised CDN, XSS) can steal the token with `localStorage.getItem('token')`. The token is valid for 24 hours with no refresh rotation.

**Action:** Migrate to httpOnly cookies for the JWT. The backend is already stateless — just change the transport. httpOnly cookies cannot be read by JavaScript.

---

### M6 — No email verification gate after registration ✅ FIXED (2026-06-22)
Implemented: email is now required at signup, a verification link is emailed (Gmail SMTP), and the `VERIFIED` authority gates needs/connections/messages/reviews writes. Existing + demo + Google + guest accounts are grandfathered/auto-verified. See `docs/superpowers/specs/2026-06-22-email-verification-design.md`. (Note: phone OTP was dropped because Twilio charges per SMS.)

**File:** `AuthService.java:42-67`  
**Risk:** Users receive a JWT immediately after signup with no email verification step. There is no `emailVerified` field on the User entity. Accounts with fake/unverified emails have full platform access.

**Action:** Add an `emailVerified` boolean to the User entity. On registration, send a verification link. Gate authenticated endpoints (except `/api/auth/verify-email`) behind `emailVerified = true` in `JwtAuthFilter`.

---

### M7 — No rate limiting on `change-password` and `verify-id` endpoints
**File:** `AuthController.java:44,52`  
**Risk:** `POST /api/auth/change-password` has no rate limit — an attacker can attempt rapid password changes. `POST /api/auth/verify-id` has no rate limit — an attacker can spam file uploads.

**Action:** Apply `ipRateLimiter.check(request)` to both endpoints.

---

### M8 — Phone numbers logged in plaintext
**File:** `SosService.java:50,60,62,75,85,87`  
**Risk:** Multiple log statements include `toNumber` (user phone number) directly. Phone numbers are PII and should not appear in application logs.

**Action:** Remove phone numbers from all log statements. Log only anonymized identifiers (e.g., `userId`).

---

### M9 — CSP header breaks legitimate app content
**File:** `SecurityConfig.java:51-53`  
**Code:**
```java
.contentSecurityPolicy(csp -> csp
    .policyDirectives("default-src 'self'; frame-ancestors 'none'"))
```
This CSP will block AWS S3 image URLs, WebSocket connections (`wss://`), Google OAuth redirects, and any external fonts/assets. The app will likely break in production with this policy active.

**Action:** Extend the CSP to cover actual app content:
```
default-src 'self';
img-src 'self' https://*.amazonaws.com data:;
connect-src 'self' wss: https://accounts.google.com;
frame-ancestors 'none';
style-src 'self' 'unsafe-inline';
```
Test in a staging environment before deploying.

---

### M10 — `facebookUrl` / `instagramUrl` accept any string including `javascript:` URIs
**Files:** `ElderProfileRequest.java:23-24`, `HelperProfileRequest.java:22-23`  
**Risk:** No URL format validation exists on social profile URLs. A user can store `javascript:alert(document.cookie)` as their Facebook URL. If the frontend renders this as an `<a href>`, clicking it executes JavaScript.

**Action:** Add `@Pattern(regexp = "^https://.*")` to both fields, or use `@URL` from Hibernate Validator with `protocol = "https"`.

---

### M11 — In-memory rate limiters reset on app restart
**Files:** `LoginRateLimiter.java`, `IpRateLimiter.java`  
**Risk:** All brute-force counters are stored in memory (Caffeine cache). A Railway redeploy clears all lockouts. An attacker can trigger a restart or wait for the scheduled deploy cycle.

**Action:** Persist lockout state in Redis (which is already integrated). The OTP lockout already does this correctly via the DB (`phoneOtpLockedAt` field) — apply the same pattern to login and IP limiters.

---

### M12 — Redis has no connection timeout configured
**File:** `application.yml`, `RedisConfig.java`  
**Risk:** `spring.data.redis.timeout` is not set. If Redis becomes slow or unresponsive, threads calling Redis operations block indefinitely, exhausting the thread pool.

**Action:** Add to `application.yml`:
```yaml
spring:
  data:
    redis:
      timeout: 2000ms
      connect-timeout: 1000ms
```

---

## LOW Findings

### L1 — `dangerouslySetInnerHTML` on SVG icon strings
**Files:** `ElderDashboard.jsx:125`, `HelperDashboard.jsx:112`  
**Risk:** Currently safe because the injected values come from a hardcoded `TAB_ICONS` constant. If this constant ever receives server-sourced or user-supplied content, it becomes an XSS vector.

**Action:** Replace with proper React SVG components or import SVGs as components.

---

### L2 — No HSTS header configured
**Risk:** No `Strict-Transport-Security` header is set. Browsers will not enforce HTTPS on repeat visits, leaving room for SSL-stripping attacks.

**Action:** Add to `SecurityConfig`:
```java
.headers(h -> h.httpStrictTransportSecurity(hsts -> hsts
    .includeSubDomains(true).maxAgeInSeconds(31536000)))
```

---

### L3 — `PhoneVerifyRequest.otp` has no constraints and no `@Valid`
**Files:** `AuthController.java:70`, `PhoneVerifyRequest.java`  
**Risk:** The OTP field accepts any string of any length. While the DB-level lockout (5 attempts) limits brute force, there is no server-side format rejection to fail fast on obviously invalid inputs.

**Action:** Add `@NotBlank @Pattern(regexp = "^[0-9]{6}$") String otp` to the DTO and add `@Valid` to the controller parameter.

---

### L4 — Free-text fields have no `@Size(max = ...)` limit
**Risk:** `bio`, `description`, `title`, `content` (message), `comment`, `reason`, `message` (apply), `requestMessage`, `note` — all accept unbounded strings. A single large message could cause DB column overflow or application memory pressure.

**Action:** Add `@Size(max = 2000)` (or appropriate limit) to each free-text field. For `MessageRequest.content`, use `@Size(max = 2000)`.

---

### L5 — File uploads rely on extension check only (no magic bytes)
**File:** `S3Service.java:89-95`  
**Risk:** Extension check only. Renaming `malware.exe` to `malware.png` passes. Files go to S3 and are not executed server-side, so the risk is primarily content-type spoofing and browser behavior.

**Action:** Add Apache Tika to validate actual file content type matches the extension.

---

### L6 — `dateOfBirth` in `RegisterRequest` accepts any date
**File:** `RegisterRequest.java:19`  
**Risk:** No `@Past` or age validation exists. Users can register with a birth date in the future.

**Action:** Add `@Past` and validate minimum age (e.g., 18+ or 60+ for elder role) in the service layer.

---

### L7 — `FeedbackRequest.email` has no `@Email` constraint
**File:** `FeedbackRequest.java:12`  
**Risk:** Any string is accepted as the feedback email, including garbage values that make the feedback unactionable.

**Action:** Add `@Email` to `FeedbackRequest.email`.

---

### L8 — `application-dev.yml` hardcodes DB password
**File:** `backend/src/main/resources/application-dev.yml:6`  
**Code:** `password: "0000"`  
**Risk:** Hardcoded credentials in version-controlled config. Low risk for a local dev password, but establishes a bad pattern.

**Action:** Replace with `password: ${DB_PASSWORD:0000}`.

---

### L9 — No Permissions-Policy header
**Risk:** No `Permissions-Policy` header restricts browser feature access (camera, microphone, geolocation).

**Action:** Add `Permissions-Policy: camera=(), microphone=(), geolocation=(self)` via a response filter or Spring Security header customization.

---

### L10 — No dependency CVE scanner in Maven build
**File:** `backend/pom.xml`  
**Risk:** No OWASP `dependency-check-maven` plugin or GitHub Dependabot configured. Vulnerable transitive dependencies could go unnoticed.

**Action:** Add to `pom.xml`:
```xml
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>9.2.0</version>
</plugin>
```
Or enable Dependabot in the GitHub repo settings.

---

## What's Already Done Correctly ✅

| # | Check | Evidence |
|---|-------|---------|
| 1 | All secrets from environment variables | `application.yml` — no hardcoded secrets in production config |
| 2 | Google OAuth client secret not in git | `git ls-files \| grep client_secret` returns nothing |
| 3 | BCrypt password hashing | `SecurityConfig.java` — `BCryptPasswordEncoder` bean |
| 4 | Login rate limiting (by identifier) | `LoginRateLimiter.java`, `AuthService.java:95,100` |
| 5 | OTP rate limiting | `OtpRateLimiter.java`, `AuthService.java:163` |
| 6 | IP rate limiting on register + guest | `IpRateLimiter.java`, `AuthController.java:27,39` |
| 7 | OTP brute-force lock persisted to DB | `AuthService.java:28-29`, `phoneOtpLockedAt` field |
| 8 | JWT stateless (no server sessions) | `SecurityConfig.java` — `STATELESS` session policy |
| 9 | JWT minimum length validated at startup | `JwtUtil.java:26-27` — `@PostConstruct` guard |
| 10 | Connection ownership verified on all messaging | `MessageService.getAuthorizedConnection()` |
| 11 | Connection participant checks everywhere | `ConnectionService` lines 113, 157 |
| 12 | Need ownership verified on all need mutations | `NeedService` lines 129, 189, 205, 216 |
| 13 | Emergency contact ownership verified | `EmergencyContactService.java:51` |
| 14 | Admin endpoints gated by `ADMIN` authority | `SecurityConfig.java:63` |
| 15 | Suspended users blocked even with valid JWT | `JwtAuthFilter.java:46` — `getIsActive()` checked per-request |
| 16 | `X-Frame-Options: DENY`, `X-Content-Type-Options`, Referrer-Policy | `SecurityConfig.java:47-50` |
| 17 | CORS restricted to configured origins only | `SecurityConfig.corsConfigurationSource()` |
| 18 | No SQL injection risk | All repositories use JPQL with named parameters; no native query string concatenation |
| 19 | No `eval()` or `new Function()` in frontend | Confirmed by search |
| 20 | AWS S3 MIME type set server-side (not from client header) | `S3Service.java` — server-controlled MIME map |

---

## Priority Order for Fixes

**Immediate (before any production traffic):**
1. C1 — Rotate Twilio + AWS credentials; set proper JWT secret in Railway
2. C2 — Remove OTP from logs in `SosService.java`
3. H1 — Add participant check to `ReviewService.submitReview()`
4. H3 — Add `WebSocketSecurityConfig` with JWT channel authentication
5. H8 — Implement `DELETE /api/users/me` for GDPR compliance

**Before public launch:**
6. H2 — Token revocation on password change
7. H4 — IP rate limiting on login endpoint
8. H5 — Log 401/403 events
9. M2 + M3 — Standalone Privacy/Terms pages with real content
10. M5 — Migrate JWT to httpOnly cookie
11. M9 — Fix CSP to not break S3 images, WebSockets, OAuth
12. M10 — Validate `facebookUrl`/`instagramUrl` format

**Next sprint:**
13. M1 — User data export endpoint
14. M6 — Email verification gate
15. L1-L10 — Remaining low-severity items
