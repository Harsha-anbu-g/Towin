# Landing Story Slides — Design

**Date:** 2026-06-10
**Status:** Approved by user (pending spec review)

## Goal

Today, visitors land straight on the login page and get stuck — they don't know
what ToWin is or why they should care. Replace the entry with a short, guided
story so that a first-time visitor:

1. **Knows what ToWin is** — a place where elders and helpers meet.
2. **Knows why it exists** — the exchange between generations, and how trust is built.
3. **Can start using it without any difficulty** — every slide has one idea, one
   clear next step, and an escape hatch to log in.

Success criteria: a brand-new visitor (including an elder on a phone) can read
the story in under a minute, then reach Create Account, Log In, or a Demo
account in one tap.

## Decisions made

- **After Start → existing login page.** The login page already offers all
  three paths (sign-in form, "Create one" link, Elder/Helper demo buttons).
  No new chooser page.
- **Format: step-by-step story slides**, not a scrolling page. Full-screen
  chapters with Next/Back, progress dots, and a persistent skip-to-login link.

## Flow & routes

- `/` → new **Landing** page (currently redirects to `/login`).
- Logged-in visitors to `/` are redirected to their dashboard (`/admin` for
  admins) — wrap the route in the existing `PublicRoute`.
- Every slide shows a quiet **"Already a member? Log in"** link (top corner)
  so returning users skip the story in one tap.
- Final slide: large **Start** button → `/login`.
- `BfCacheGuard` in `frontend/src/App.jsx`: add `/` to its public paths.
- The `*` catch-all keeps redirecting to `/login` (returning users' intent).

## The story — 6 slides

Plain everyday words. One idea per slide. No jargon.

1. **Welcome** — turtle logo, "ToWin — where two generations win together,"
   and a "See why →" button to begin.
2. **Two kinds of people** — Elder and Helper cards side by side. "You choose
   your role when you create your account." (Language matches the existing
   how-it-works guide: Elder = older person looking for friendship, company,
   or help; Helper = younger person offering companionship and a hand.)
3. **What ToWin solves** — elders need help with everyday things but have no
   energy to do them alone; helpers are ready to do whatever they ask.
4. **The real problem is trust → Trust Score** — trust is earned, not given.
   Three parts: Profile, Rooting, Review — same terms as the guide, so nothing
   contradicts.
5. **Rooting, step by step** — every connection grows through 7 gentle stages;
   both people must agree to each step; nothing personal is shared until trust
   grows.
6. **Why ToWin** — today's elders use phones, the internet, and pay online —
   and tomorrow there will be many more. Their biggest problems: loneliness
   and no energy. They have time and money; helpers have energy and need money
   and warmth. ToWin is where they exchange — and both win. Big **Start**
   button → `/login`. Secondary link: "Read the full guide" → `/how-it-works`.

## Look & feel

- Existing sky-blue palette (`#4FA3CE` family), SF typography, turtle logo —
  consistent with the login hero and guide.
- Full-screen calm slides; gentle framer-motion fade between slides.
- Dot progress indicators; large Next/Back buttons (elder-friendly tap
  targets, ≥48px).
- Mobile-first layout; must look right at phone widths.

## Structure

- `frontend/src/pages/Landing.jsx` — slide shell: current-slide state,
  progress dots, Next/Back, skip link.
- `frontend/src/data/landingContent.jsx` — slide content, mirroring the
  existing `guideContent.jsx` pattern (array of steps with render functions).
- No backend changes. No API calls. No new dependencies.

## Error handling

Static page — no network, so no loading/error states. Only edge cases:

- Logged-in user hits `/` → redirect to dashboard (handled by `PublicRoute`).
- Page restored from bfcache → `BfCacheGuard` treats `/` as public.

## Testing

Playwright (webapp-testing) verification:

- `/` shows slide 1; Next/Back and dots navigate correctly.
- "Already a member? Log in" link and final Start button both land on `/login`.
- Logged-in user visiting `/` is redirected to their dashboard.
- Mobile-viewport screenshots of each slide.

## Out of scope

- No changes to the login page, register page, or how-it-works guide.
- No payments features — slide 6 describes the exchange as the idea behind
  ToWin, not an in-app payment feature.
- No "seen it before" skip-memory (localStorage) — returning users use the
  log-in link; can be added later if the story gets in the way.
