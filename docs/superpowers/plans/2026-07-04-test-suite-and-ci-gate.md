# Plan 14 — Test Suite + CI Deploy Gate

**Date:** 2026-07-04
**Goal:** Stop shipping to production with no safety net. Every push to `main`
currently auto-deploys the backend to Railway with only 85 unit tests and zero
frontend tests standing in the way. This plan adds a CI gate and widens test
coverage where it matters most for an elderly-care platform: emergency,
safety, trust, and money-path logic.

## Baseline (verified 2026-07-04)

- Backend: 85 tests across 15 files, all passing (`./mvnw test`, pure Mockito
  unit style, no DB needed).
- Frontend: `npm run lint` and `npm run build` pass; **no test runner installed**.
- CI: none — `.github/workflows/` does not exist.
- Deploys: Railway builds backend Docker image on every push to `main`;
  Vercel builds frontend on `frontend/` changes.

## Untested backend services (by risk)

| Service | Lines | Why it matters |
|---|---|---|
| SosService | 90 | Emergency button for elderly users — safety critical |
| ReportService | 47 | Abuse/safety reports |
| ReviewService | 142 | Reviews feed the trust score |
| InactivityCheckService | 48 | Detects elders gone quiet — safety |
| DiscoveryService | 172 | Matching elders with helpers |
| AccountService | 210 | Account lifecycle (dangerous if wrong) |
| FeedbackService | 62 | Beta feedback |
| AssistantService | 218 | Tortoise AI bot (follow-up phase) |
| OAuthService | 142 | Google sign-in (follow-up phase) |
| EmailService / S3Service | 219 | Thin wrappers over SMTP/S3 (low value to mock-test) |

## Phase 1 — CI workflow

`.github/workflows/ci.yml` with two independent jobs:

- **backend**: JDK 21 (temurin) + Maven cache → `./mvnw -B test`
- **frontend**: Node 22 + npm cache → `npm ci`, `npm run lint`,
  `npm run test -- --run`, `npm run build`

Runs on every push to `main` and every PR. No deploy steps — Railway and
Vercel keep doing the deploying; CI is the tripwire.

**Manual step (user, one time):** in Railway → backend service → Settings →
enable **"Wait for CI"** so the Docker build only starts after GitHub checks
pass. Until that toggle is flipped, CI is advisory (red X on the commit) but
does not block the deploy.

## Phase 2 — Backend tests (this session)

New test classes in the existing style (plain JUnit 5 + Mockito
`@Mock`/`@InjectMocks`, AssertJ, no Spring context):

- `SosServiceTest`, `ReportServiceTest`, `ReviewServiceTest`,
  `InactivityCheckServiceTest` — emergency + safety + trust inputs
- `DiscoveryServiceTest`, `AccountServiceTest`, `FeedbackServiceTest`

Focus: happy path + the failure modes that hurt users (wrong recipient on an
SOS, review counted twice, account deleted while connections active, etc.).

## Phase 3 — Frontend tests (this session)

- Add Vitest + React Testing Library + jsdom + jest-dom + user-event.
- `npm run test` script; vitest configured through the existing Vite config.
- First wave of tests:
  - `src/lib/utils.js` — pure logic
  - `src/api/axios.js` — auth header + 401 handling interceptors
  - `src/lib/TrustBadge.jsx` — trust display rules (brand-critical)
- Pattern established so future pages get tests as they're touched.

## Phase 4 — Follow-ups (separate sessions)

- **Lint debt:** `npm run lint` was silently failing before this plan (an
  earlier check piped through `tail` masked the exit code). Excluding the
  `.vercel` build output from ESLint dropped it from 261 errors to 53 real
  ones across 17 src files (unused vars, empty catches,
  react-refresh/only-export-components in data files, setState-in-effect).
  The CI lint step is `continue-on-error: true` until these are fixed — then
  flip it to blocking.
- AssistantService + OAuthService tests.
- Controller-layer tests (`@WebMvcTest`) for auth + admin endpoints.
- Playwright end-to-end smoke: register → verify → login → dashboard,
  run against a local backend with a throwaway Postgres.
- Coverage reporting (JaCoCo + vitest coverage) with a floor that ratchets up.

## Verification

- `./mvnw test` green locally with the new tests.
- `npx vitest run` green locally.
- CI workflow green on GitHub for the push.
- No production code changes in this plan — tests + CI config only.

## Results (2026-07-05)

- [x] CI workflow live (`.github/workflows/ci.yml`)
- [x] Backend tests added and green — 85 → **154 tests** (+69 across 7 new
      test classes: Sos, InactivityCheck, Report, Review, Discovery,
      Account, Feedback)
- [x] Frontend test infra + first tests green — Vitest 4 + RTL, **21 tests**
      (utils date parsing, axios session-expiry interceptors, TrustBadge)
- [x] Pushed; CI green on GitHub
- [ ] User flipped Railway "Wait for CI" (manual, pending)

### Bug findings from test-writing (report only, nothing changed)

Safety-critical, worth fixing soon:
1. `SosService.triggerSos` logs "SOS sent to N contacts" even when Twilio is
   unconfigured or every SMS failed — an elder's SOS looks successful while
   nobody was notified. `sendSms` swallows all exceptions.
2. `InactivityCheckService` stamps `inactivityAlertedAt` for elders with zero
   emergency contacts — they're skipped by the cooldown forever and nobody is
   ever told.
3. `EmergencyContact.inactivityDays` (per-contact setting) is ignored; the
   check hardcodes 5 days, duplicated in two classes.

Trust/privacy:
4. Safety-concern reviews show "Anonymous" but still expose `reviewerId`.
5. Connection-based reviews (no need) bypass the duplicate guard — unlimited
   reviews against the same person, each recalculating trust.
6. No duplicate-report guard in ReportService; `Report.status` is a raw string.

Correctness/robustness:
7. `DiscoveryService` compares UUIDs with `!=` (dead code today, trap later).
8. Helpers without coordinates sort as distance 0.0 — outrank nearby helpers.
9. Language/interest filters pass profiles with null arrays.
10. `@Cacheable` keys omit page size — wrong page-size results served from cache.
11. `AccountService.purgeUserData` may hit an FK violation: trust logs
    confirmed by the other party survive until connection delete.
12. `deleteOwnAccount` purges irreversibly with no active-connection guard.
