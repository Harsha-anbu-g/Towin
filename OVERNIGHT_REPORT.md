# Overnight Report — 2026-06-12

## App map (verified against code + running app)

**ToWin** — connects elders (need company/help) with helpers (offer it). Core
differentiator: trust is built stepwise ("Rooting", 7 stages: Discovered →
Messaging → Phone → Video → Verified → First Meet → Trusted) and a Trust Score
(profile completeness + rooting points + star reviews).

**Stack**
- `frontend/` React 19 + Vite 8, react-router 7, inline styles + `index.css`
  tokens/media queries. Dev server :5173 (owner's). NOT deployed anywhere —
  the resume link can only be the Railway backend or a future frontend deploy
  (plan exists at docs/superpowers/plans/2026-05-27-railway-deploy.md).
- `backend/` Spring Boot 3.2 (Java 21 syntax, runs on 25), Postgres + Flyway
  (V1–V9, additive only), JWT (HS, 24 h), modules: auth, profile, connection,
  trust, need, messaging, review, streak, discovery, emergency, feedback,
  report, admin. Railway auto-deploys on push to `main`
  (backend-production-cef3.up.railway.app). Local backend :8080 (restarted
  tonight; was running 3-week-old code — that's why discovery 500'd).
- Caching: Caffeine in-memory (5-min TTL) or Redis when `app.redis.enabled`.

**Frontend routes**
`/` landing story (6 slides) · `/login` · `/register` · `/how-it-works` guide ·
`/dashboard` (role-routed Elder/Helper) · `/messages` inbox + `/messages/:id`
chat · `/profile` · `/trust` score breakdown · `/streaks` elder check-in ·
`/game` Peekaboo · `/emergency-contacts` (elder) · `/user/:id` · `/admin` ·
`/feedback` (public).

**Demo accounts** (exist in local + prod DB, created manually — no seeder in
the repo): elder@gmail.com / 12345678 (Margaret), helper@gmail.com / 123456789
(James). Local extras: David Chen (elder), Priya Sharma (helper), both@ users
in Montreal.

**Known weak points at start of night**
- No demo entry on the landing itself (only on /login).
- No code-managed demo data: nothing guarantees prod demo accounts show every
  feature; trust stages exist at only one level (Margaret↔James TRUSTED).
- Dashboards = 4–5 flat tabs, weak hierarchy.
- Unit tests broken on main before tonight (TrustScoreServiceTest 9 errors —
  missing `elderProfileRepository` mock; MessageServiceTest 2) — pre-existing,
  verified by stashing.
- window.confirm/alert in places; suspended users keep working tokens.

## Decisions log

- (carried from tonight, already on main) dead-session recovery via axios
  401/403 interceptor + JWT exp check; discovery cache TTL; real phone field
  at signup; landing tortoise walk-in animation; modern auth cards.

## Changes (newest first)
<!-- one line per commit, added as the night progresses -->
- `b8e3989` dashboards restructured: Home + quick actions on both roles,
  Post Request merged into My Requests (inline form), tabs renamed
  (My Helpers / My Elders), native window.confirm/alert replaced with
  inline confirms + toast. Verified in browser: elder Home shows trust at
  two stages + pending request with Accept/Decline; quick action opens the
  post form directly.
- **Prod verified**: demo elder on Railway now has 5 connections at 4 trust
  stages (TRUSTED / PHONE / MESSAGING / PENDING) — seeder ran on deploy.
- `dcd2cb2` suspended/deleted accounts lose tokens immediately (JwtAuthFilter
  gates on isActive — row was already loaded for lastSeenAt, zero extra cost)
- `fbe246c` unit suite repaired, 54/54 green — pushes are now test-gated
- `25d3fd0` DemoDataSeeder: idempotent/additive; demo world now has 6 personas,
  connections at 5 trust stages incl. a PENDING request, messages, needs
  (open/completed + an application), reviews both directions, streaks,
  emergency contact; runs on every boot, never deletes
- `8da1642` one-click demo entry (Elder/Helper) on every landing slide
- (pre-midnight, same session) dead-session recovery, real phone at signup,
  admin pagination, walking tortoise, prototype note, modern auth cards,
  discovery cache TTL

## Decisions log (tonight)
- Seeder is additive-only; "reset" = baseline always restored on boot, but
  recruiter-created extra data is left alone (hard limit: never destroy data).
- Demo accounts get pinned to a downtown-Toronto location only when their
  location is NULL, and get VERIFIED status — required for discovery and a
  believable trust profile.
- Existing demo creds (elder@gmail.com / helper@gmail.com) kept as the demo
  identities since they're already seeded in prod and wired into Login/Landing.

## Needs morning review
- Resume link target: frontend is not deployed; report assumes the link will
  point at a deployed frontend later. Railway frontend deploy plan exists but
  creating a new Railway service might cost money → NOT done (hard limit 4).
