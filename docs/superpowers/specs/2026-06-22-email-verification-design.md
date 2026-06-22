# Email Verification — Design

**Date:** 2026-06-22
**Status:** Approved
**Author:** brainstormed with user

## Problem

ToWin's local signup currently collects no email and performs no verification — anyone (including bots) can mass-create accounts with fake details. Phone OTP existed as a verification signal but is abandoned because Twilio charges per SMS. Email verification is the free replacement.

## Goal

Every new local signup must register with an email and verify it (Instagram-style) before using core features. Existing accounts and demo accounts keep working unchanged.

## Decisions (locked)

- **Email is required at signup** (new field on the register form + DTO).
- **Hard gate:** an unverified user can log in and edit their profile, but cannot post/apply to needs, send connection requests, send messages, or leave reviews until they click the verification link.
- **Provider:** Gmail SMTP via Spring's `JavaMailSender` (free, ~500/day).
- **Grandfathering:** all accounts that exist when this ships are marked verified. Only brand-new signups must verify.
- **Demo accounts** (`elder@gmail.com`, `helper@gmail.com` from `DemoDataSeeder`) are always created verified.
- **Google OAuth** users are auto-verified (Google already verified the address).
- **Guest "try it" accounts** are auto-verified so the trial flow keeps working.

## Flow

1. User registers with email + password → account saved with `emailVerified = false`, a random token, and a 24h expiry.
2. Backend emails a link: `https://<frontend>/verify-email?token=<random>`.
3. User clicks → frontend `/verify-email` page calls `POST /api/auth/verify-email` with the token.
4. Backend validates the token (exists, not expired), sets `emailVerified = true`, clears the token.
5. The user can now use all features.

## Backend changes

### Data (Flyway `V32__add_email_verification.sql`)
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP;
UPDATE users SET email_verified = TRUE;   -- grandfather existing accounts
```

### `User` entity
Add `emailVerified` (boolean, default false), `emailVerificationToken` (String), `emailVerificationExpiresAt` (LocalDateTime).

### `RegisterRequest`
Add `email` field: `@NotBlank @Email`. Registration also rejects duplicate emails (the `users.email` column is already unique).

### `EmailService` (new)
Wraps `JavaMailSender`. One method: `sendVerificationEmail(String to, String link)`. Sends a simple HTML email with the verify link. If mail is not configured (no credentials), logs a warning and no-ops (so local dev without SMTP still works) — mirrors the existing Twilio "not configured" pattern.

### `AuthService`
- `register`: persist email, generate `SecureRandom` token, set 24h expiry, `emailVerified = false`, send the email.
- `guestLogin`: set `emailVerified = true`.
- `verifyEmail(String token)`: find the user by token, check expiry, set verified, clear token.
- `resendVerification(UUID userId)`: regenerate token + expiry, resend email (rate-limited).

### OAuth success handler
When creating a new user from Google, set `emailVerified = true`.

### Endpoints (`AuthController`)
- `POST /api/auth/verify-email` — body `{ token }`. Public. Returns 200 on success, 400 on invalid/expired.
- `POST /api/auth/resend-verification` — authenticated, IP-rate-limited via existing `IpRateLimiter`.

### The gate (`JwtAuthFilter` + `SecurityConfig`)
- In `JwtAuthFilter`, when building authorities, add a `VERIFIED` authority only when `user.isEmailVerified()`.
- In `SecurityConfig`, require `hasAuthority("VERIFIED")` on the write endpoints:
  - `POST/DELETE /api/needs/**` (post, apply, withdraw, etc.)
  - `POST /api/connections/**` (request, respond)
  - `POST /api/messages/**` (send)
  - `POST /api/reviews/**` (submit)
- Reading/browsing, profile editing, and the verify/resend endpoints stay open.
- Centralized so the gated set is visible in one place.

### Demo seeder
`DemoDataSeeder` sets `emailVerified = true` on every account it creates.

## Frontend changes

- **Register form** (`Register.jsx`): add a required email input.
- **New `/verify-email` page**: reads `?token=`, calls `POST /api/auth/verify-email`, shows success or failure with a link to log in.
- **Verify-reminder banner**: for a logged-in but unverified user, show a "Please verify your email" banner with a "Resend" button. (Shown app-wide like the existing BetaBanner.)
- **App.jsx**: add the public `/verify-email` route.

## Config (Gmail SMTP)

`application.yml` adds a `spring.mail` block bound to env vars:
```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: ${MAIL_USERNAME:}
    password: ${MAIL_PASSWORD:}
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true
app:
  mail:
    from: ${MAIL_FROM:${MAIL_USERNAME:}}
    verify-base-url: ${APP_VERIFY_BASE_URL:http://localhost:5173}
```
`MAIL_PASSWORD` is a Google **app password** (not the account password). User generates it at Google Account → Security → App passwords (2FA must be on). These go into Railway env vars for production and the local `.env` for dev.

## Security notes

- Token is `SecureRandom`, single-use, 24h expiry, cleared on success.
- Resend is rate-limited to prevent email-bombing.
- The gate fails safe: no `VERIFIED` authority → write endpoints return 403.
- The app keeps working throughout — the gate only blocks 4 write actions for unverified new users.

## Out of scope

- Password reset by email (future; the token infra here makes it easy later).
- Migrating existing accounts to collect emails (they're grandfathered).
- Changing the trust score formula (email-verified could feed trust later, but not in this change).
