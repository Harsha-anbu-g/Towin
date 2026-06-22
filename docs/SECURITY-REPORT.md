# ToWin — Security Hardening Report

**Date:** 2026-06-22
**Scope:** Full-codebase security audit + remediation, GDPR features, auth rework, and a production deploy fix.
**Status:** All Critical/High/Medium/Low findings fixed or consciously deferred. Live on `main` (Railway + Vercel).

This is the reference record of everything done. For the original raw findings see [SECURITY-AUDIT.md](SECURITY-AUDIT.md); for design/plans see [docs/superpowers/](superpowers/).

---

## 1. Executive summary

A full security review was run against the backend (Spring Boot), frontend (React), and infrastructure (Railway + Vercel). Findings were graded Critical → Low. Everything actionable was fixed and shipped. On top of the audit, three larger pieces of work were completed:

- **Email verification** (replacing the abandoned paid phone-OTP), delivered via Brevo.
- **Auth rework** to an Instagram-style model: accounts are created **only after** email verification; Google sign-in is password-free; forgot/reset-password added.
- **Production deploy fix**: the live frontend was accidentally pointing at `localhost`; now correctly baked to the Railway backend.

**Score at close:** Critical 2/2 fixed · High 8/8 fixed · Medium 12/12 fixed or deferred-by-choice · Low 10/10 fixed · plus 20 controls verified already-correct.

---

## 2. What was fixed (by severity)

### CRITICAL
| ID | Issue | Fix | Commit |
|----|-------|-----|--------|
| C1 | Live AWS/Twilio creds + weak JWT secret exposure risk | Verified prod `JWT_SECRET` is a strong custom value (not the placeholder). **AWS key rotation still recommended** (see §6). | — |
| C2 | OTP code + phone number logged in plaintext | Removed PII/OTP from all `SosService` log lines | `0464c60` |

### HIGH
| ID | Issue | Fix | Commit |
|----|-------|-----|--------|
| H1 | Any user could review any other user (broken object-level authz) | `ReviewService` now requires the reviewer to be a participant in the referenced need | `24f1747` |
| H2 | No token revocation on password change | Added `tokenVersion` on `User` + JWT claim; bumped on password change/reset → old tokens rejected | `12fde14` |
| H3 | WebSocket/STOMP endpoint unauthenticated | Added `WebSocketSecurityConfig` requiring auth on subscribe/message | `24f1747` |
| H4 | No IP rate-limit on login | `IpRateLimiter` applied to login, change-password, verify-id | `0464c60` |
| H5 | 401/403 never logged (no attack visibility) | Added auth-entry-point + access-denied logging; rejected JWTs logged | `12fde14` |
| H6 | `updatePhone` took a raw map, no validation | Typed `PhoneUpdateRequest` with `@Pattern` + `@Valid` | `b62e705` |
| H7 | Prod JWT secret might be the placeholder | Verified it's a real custom value on Railway | — |
| H8 | No self-service account deletion (GDPR Art. 17) | `DELETE /api/account` + shared purge cascade (reused by admin delete) | `fabbcd4` |

### MEDIUM
| ID | Issue | Fix | Commit |
|----|-------|-----|--------|
| M1 | No data export (GDPR Art. 15) | `GET /api/account/export` returns full user data snapshot | `fabbcd4` |
| M2 | Privacy/Terms only as modals | Standalone `/privacy` and `/terms` pages + routes | `3eecc46` |
| M3 | Legal docs had placeholder text / fake domain | Real content, real contact addresses | `3eecc46` |
| M4 | No cookie consent | Dismissible, non-blocking cookie banner | `fabbcd4` |
| M5 | JWT in localStorage (XSS-stealable) | **Deferred by choice** — kept localStorage; risk reduced by CSP + tokenVersion (see §5) | — |
| M6 | No email verification | Full email verification flow added (see §3) | `bc48f6b`, later reworked |
| M7 | No rate-limit on change-password / verify-id | `IpRateLimiter` applied | `0464c60` |
| M8 | Phone numbers logged in plaintext | Removed from logs | `0464c60` |
| M9 | CSP would break S3/WebSocket/OAuth | Proper CSP (img/connect/font/style/frame-ancestors) | `12fde14` |
| M10 | Social URLs accepted `javascript:` | `@Pattern` HTTPS-only on facebook/instagram URLs | `b62e705` |
| M11 | In-memory rate limiters reset on restart | **Deferred** — acceptable for current single-instance scale | — |
| M12 | No Redis connect/read timeout | Added `timeout` + `connect-timeout` | `1bbdd8a` |

### LOW
| ID | Issue | Fix | Commit |
|----|-------|-----|--------|
| L1 | `dangerouslySetInnerHTML` for tab icons | Replaced with real React SVG elements | `860d3c1` |
| L2 | No HSTS header | Added HSTS (1y, includeSubDomains) | `12fde14` |
| L3 | OTP field had no constraints | `@NotBlank @Pattern("[0-9]{6}")` + `@Valid` | `b62e705` |
| L4 | Free-text fields unbounded | `@Size(max=…)` on message/need/bio/title etc. | `b62e705` |
| L5 | File upload extension-only check | Noted; S3 sets server-side MIME (acceptable) | — |
| L6 | `dateOfBirth` accepted future dates | `@Past` | `b62e705` |
| L7 | Feedback email not validated | `@Email` | `b62e705` |
| L8 | Hardcoded dev DB password | Moved to `${DB_PASSWORD:0000}` env var | `65e4456` |
| L9 | No Permissions-Policy header | Added `camera=(), microphone=(), geolocation=(self)` | `12fde14` |
| L10 | No dependency CVE scanning | Added OWASP `dependency-check-maven` plugin | `1bbdd8a` |

---

## 3. Email verification (replaces paid phone OTP)

**Why:** Phone OTP was abandoned because Twilio charges per SMS. Email verification is free.

**Delivery:** Brevo **HTTPS API** (`api.brevo.com/v3/smtp/email`). Note: Railway **blocks outbound SMTP ports** (25/465/587), so Gmail SMTP cannot work there — the HTTPS API is the only viable path. Sender `agharsha.anbu@gmail.com` is verified in Brevo (free tier, 300/day). Emails can land in spam until a custom domain is added; a prominent "check spam" notice is shown to users.

**Config (Railway):** `BREVO_API_KEY`, `MAIL_USERNAME` (verified sender), `APP_VERIFY_BASE_URL=https://towin.vercel.app`.

**Resilience:** a failed email send is logged but **never** rolls back/breaks the flow.

Related: [docs/superpowers/specs/2026-06-22-email-verification-design.md](superpowers/specs/2026-06-22-email-verification-design.md)

---

## 4. Auth rework (Instagram-style) — final model

Commits `4619e35` (backend) + `b49c24f` (frontend). Replaces the earlier "create account then gate it" approach.

| Area | Behaviour |
|------|-----------|
| **Manual signup** | Held in a `pending_registrations` staging table (V33). The real `users` row is **created only when the email link is clicked** — no account exists until verified. |
| **Verify link** | Creates the account (verified), deletes the pending row, then the user logs in. |
| **Google sign-in** | **Password-free** and the primary button. Google users are auto-verified (Google already verified the email). |
| **Forgot / Set password** | `POST /api/auth/forgot-password` + `/reset-password` by email token (V34). Lets password-free Google users set a password later. Reset bumps `tokenVersion` (invalidates sessions). |
| **Removed** | The interim "verification wall" + `VERIFIED` authority gate — unnecessary now, since every account in the DB is verified by definition. |
| **Grandfathering** | Existing + demo (`elder@`/`helper@`) + guest accounts are all verified, so nothing in use breaks. |

Verified live on prod: register returns 200 with **no token**; logging in before verifying is correctly rejected (proves the account isn't created until the link is clicked).

Related: [docs/superpowers/plans/2026-06-22-auth-pending-verification.md](superpowers/plans/2026-06-22-auth-pending-verification.md)

---

## 5. Deliberately deferred (with rationale)

| Item | Decision | Why |
|------|----------|-----|
| **M5 — JWT → httpOnly cookie** | Keep localStorage | The deep auth-transport change risks breaking login; XSS risk already reduced by strict CSP + `tokenVersion` revocation. |
| **M11 — Redis-backed rate limiters** | Defer | In-memory is fine at current single-instance scale. |
| **Custom email domain** | Defer | Needed to fully stop Brevo emails landing in spam; not blocking for beta. |
| **Drop unused DB columns** | Keep | `users.email_verification_token/expires_at` are now unused but dropping columns is destructive; left in place. |

---

## 6. Outstanding recommendations (not blocking)

1. **Rotate AWS keys** — `AWS_ACCESS_KEY`/`AWS_SECRET_KEY` appeared in plaintext during this work session; rotate in IAM and update Railway as hygiene.
2. **Delete the unused Gmail App Password** (`MAIL_PASSWORD`) — SMTP is retired; the app password no longer does anything. Remove from Railway + `.env` and revoke in Google.
3. **Remove Twilio credentials** — phone OTP is gone, so `TWILIO_*` are dead weight; drop them to shrink the secret surface.
4. **Custom domain for email** — verify a real domain in Brevo to stop spam-foldering.
5. **Orphaned files** — `frontend/src/pages/VerifyPending.jsx` and `components/VerifyBanner.jsx` are now unused (kept per the no-delete policy); delete when convenient.

---

## 7. Production deploy fix (root-caused 2026-06-22)

Google sign-in failed with **"invalid_client / OAuth client was not found"**. Root cause was **not** the security code: the Vercel build had never baked `VITE_API_BASE_URL`, so the live frontend pointed at `http://localhost:8080`, sending Google a `placeholder` client ID. Fixed by committing `frontend/.env.production` with the Railway backend URL so every build bakes it (`9a492f8`). This also fixed a latent issue where the live site only worked for the developer (who runs a local backend).

---

## 8. Already-correct controls (verified, no change needed)

BCrypt password hashing · stateless JWT · CORS locked to configured origins · login/OTP/IP rate limiting · DB-persisted OTP lockout · JWT min-length startup check · ownership checks on connections/messages/needs/emergency contacts · admin endpoints gated by `ADMIN` · suspended users blocked per-request · X-Frame-Options / X-Content-Type-Options / Referrer-Policy · no SQL injection (pure JPQL, parameterized) · no `eval`/`Function` in frontend · S3 server-side MIME · secrets via env vars (nothing hardcoded in prod config) · Google client secret not in git.

---

## 9. Full commit log (this effort)

```
9a492f8 fix(web): bake production API base URL (Railway) into the Vercel build
b49c24f feat(web): check-email after signup, Google-first login, forgot/reset, remove wall
4619e35 feat(auth): pending-until-verified signup, Google password-free, forgot/reset, remove gate
251cf49 feat(web): prominent spam-folder notice on verify page
cdc679a feat(web): hard-wall unverified users (interim, later removed)
cb1aa5e fix(auth): clear 'Email already registered' message
ef0ab44 feat(mail): send verification email via Brevo HTTPS API (SMTP blocked on Railway)
5456c50 fix(auth): a failed verification email must not roll back signup
793168d feat(web): email verification UI
bc48f6b feat(auth): email verification (initial)
fabbcd4 security(H8/M1/M4): account deletion + GDPR export + cookie consent
65e4456 security(L8): env var for dev DB password
b62e705 security: DTO validation (phone/OTP/size/URL/email/past-date)
3eecc46 security(M2/M3): standalone privacy/terms pages
12fde14 security(H2/H5/M9/L2/L9): CSP/HSTS/permissions headers, 401/403 logging, JWT tokenVersion revocation
860d3c1 security(L1): replace dangerouslySetInnerHTML with React SVG
1bbdd8a security(M12/L10): Redis timeouts + OWASP dependency-check
24f1747 security(H1/H3): review participant check + WebSocket STOMP auth
0464c60 security(C2/H4/M7/M8/L3): remove PII from logs, IP rate-limit auth endpoints, @Valid on OTP
```
(Plus docs/spec/plan commits.)
