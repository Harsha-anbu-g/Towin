# ToWin — "How It Works" Guide Page — Design Spec

**Date:** 2026-05-22
**Status:** Design — awaiting review

## Vision

A new public page that explains the whole ToWin platform to a person *before or after they
log in*: why ToWin exists, who it is for, what an Elder can do, what a Helper can do, and how
the trust mechanics (Trust Journey, Trust Score, Streaks) work. Today a new visitor lands on
the marketing hero or the login form with no explanation of the trust-based model that makes
ToWin different. This page closes that gap.

The page is a **guided, step-by-step walkthrough** — one topic per card, with Next / Back
navigation and clickable progress dots. A persistent **"I'm an Elder / I'm a Helper" tab**
tailors the role-specific content.

**Audience:** Elderly visitors (primary) and younger helpers (secondary). Copy and layout
follow the platform's elderly-UX principles: large readable text, simple screens, no jargon,
calm sky-blue theme.

## Scope

**In scope**
- One new frontend page at `/how-it-works` (public — no auth guard).
- Step-by-step walkthrough of 7 cards.
- A role tab (Elder / Helper) that personalizes role-specific cards; defaults to the
  logged-in user's role, else "Elder".
- Four entry points: Home page, Login page, NavBar (logged-in), and a final CTA on the page.

**Out of scope**
- No backend changes. All content is static, authored in the frontend.
- No new API calls. The page reads only `useAuth()` for the current role.
- No i18n / translation (single language, matching the rest of the app).
- No persistence of "guide completed" state.

## Architecture

Pure frontend. The page is a single React route component plus a content data module.

```
Guide.jsx (page shell)
  ├── reads useAuth() → current role → default tab
  ├── useState: stepIndex (0..6), roleTab ('ELDER' | 'HELPER')
  ├── renders: header + role tab + progress dots + current step card + Back/Next
  └── pulls step definitions from guideContent.jsx

guideContent.jsx (content module)
  └── exports STEPS: array of 7 step objects
        { id, label, icon, render(roleTab) → JSX }
```

Keeping content in `guideContent.jsx` keeps `Guide.jsx` focused on navigation behavior, and
keeps each concern independently readable.

### State & behavior

- `stepIndex` — current card (0–6). Next/Back buttons and clickable progress dots change it.
  Back is disabled on step 0; the last step shows a "Get started" CTA instead of Next.
- `roleTab` — `'ELDER'` or `'HELPER'`. Initialized from `useAuth()`:
  `HELPER → 'HELPER'`; `ELDER`, `BOTH`, `ADMIN`, or logged-out → `'ELDER'`.
  The tab is visible on every step; switching it re-renders role-aware cards.
- Changing the role tab does **not** reset `stepIndex`.
- No data fetching, no loading states, no error states — content is static.

## The 7 Step Cards

Content is sourced from the platform design spec, the Trust Score v2 plan, the Streaks plan,
the `TrustJourney` component, and `graphify-out/`. It must reflect what is **actually built**
(Trust Score **v2**: Profile + Rooting + Review — not the retired 0–100 formula).

### Step 1 — Welcome to ToWin
- **Why it exists:** loneliness among elderly people — no safe, trusted way to connect with
  others or get daily help. ToWin is a community where elders and helpers build *real*
  relationships, one small step at a time.
- **Who it's for:** two member types —
  - **Elder** — an older person looking for friendship or help.
  - **Helper** — a younger person offering companionship and practical help.
- The role tab is introduced here with a one-line prompt: "Pick how you'll use ToWin — you
  can switch anytime."

### Step 2 — What you can do *(role-aware)*
- **Elder tab:**
  - Post a help request (Companionship, Transportation, Errands, Cleaning, Other) and review
    applicants.
  - Find and connect with nearby helpers; accept or decline connection requests.
  - Message safely once a connection is active.
  - Daily Streak check-in — the page elders land on after login.
  - Emergency contacts + the always-visible **SOS** button.
- **Helper tab:**
  - Browse nearby help requests and apply.
  - Discover and connect with nearby elders.
  - Message connected elders.
  - Build a Trust Score and earn reviews from elders.

### Step 3 — The Trust Journey
Every connection between two people climbs **7 stages**. Names use the human labels from the
`TrustJourney` component:

1. **Just Connected** — view profile, send a connection request.
2. **Messaging** — text chat and photos.
3. **Phone Ready** — exchange phone numbers, call directly.
4. **Video Ready** — video calls, face to face.
5. **Verified** — identity verified, verified badge.
6. **Ready to Meet** — plan in-person visits; emergency contacts notified.
7. **Fully Trusted** — full trust, free meetings, leave & receive reviews.

Rules to convey: **both people must confirm** each step; either person can pause or end the
connection at any time; contact details unlock only as trust grows; the journey can take as
long as needed and never skips safety.

### Step 4 — Your Trust Score
- **Why it matters:** trust is *earned*, not given — the score keeps the whole community safe
  and helps elders choose who to trust.
- The score has **three parts**:
  - **Profile Score** — completeness of your profile. 8 fields (ID verified, phone verified,
    photo, social link, hobbies, occupation, bio, date of birth), 0.25 points each, max 2.0.
  - **Rooting Score** — points earned by advancing trust stages across *all* your
    relationships: Text, Voice, Video, In-person, Help session.
  - **Review Score** — the running total of all star ratings you have received.
- **Five tiers:** New Member (0–2) → Getting Started (3–14) → Reliable (15–49) →
  Highly Trusted (50–119) → Community Champion (120+).
- Reviews: after a completed engagement both people leave a 1–5 star rating, optional tags
  (Friendly, Punctual, Respectful, Helpful, Patient), and can flag a safety concern.

### Step 5 — Streaks
- A daily check-in: elders land on the Streaks screen after login and tap **"I'm here today"**
  to log that they are active.
- Tracks a **current streak** (consecutive days) and a **best/longest streak**.
- Encourages elders to show up every day; missing a day resets the current streak, longest is
  kept.

### Step 6 — The ToWin feel
- Calm **sky-blue** palette, soft white cards — never harsh, never cluttered.
- The **tortoise** logo: steady, patient progress — trust grows slowly and surely.
- Large, readable text and simple one-thing-per-screen layouts, designed so elderly users
  feel comfortable and unhurried.

### Step 7 — Get started
- A short recap of the journey: build your profile → connect → grow trust → meet safely.
- Primary CTA:
  - logged out → **"Create your account"** (`/register`).
  - logged in → **"Go to my dashboard"** (`/dashboard`).
- Secondary link back to step 1 ("Read again from the start").

## Files

### New files
| File | Purpose |
|------|---------|
| `frontend/src/pages/Guide.jsx` | Page shell — role tab, step state, progress dots, Back/Next, renders current card |
| `frontend/src/data/guideContent.jsx` | `STEPS` array — the 7 step definitions and their (role-aware) content |

### Modified files
| File | Change |
|------|--------|
| `frontend/src/App.jsx` | Import `Guide`; add public route `<Route path="/how-it-works" element={<Guide />} />` (no auth guard, placed next to `/feedback`) |
| `frontend/src/components/NavBar.jsx` | Add `<NavLink to="/how-it-works" label="How it works" />` to the nav links row |
| `frontend/src/pages/Home.jsx` | Repoint the existing `navLinks` entry `{ label: 'HOW IT WORKS', href: '#how' }` to `href: '/how-it-works'` |
| `frontend/src/pages/Login.jsx` | Add a "How it works" link beside the existing "Share feedback" link |

## Theme & styling

Follow the established inline-style system used by `Trust.jsx`, `Streaks.jsx`, and `NavBar.jsx`:

- Fonts: `-apple-system, 'SF Pro Display'` for headings, `'SF Pro Text'` for body.
- Palette: sky `#4FA3CE`, deep blue `#3D8AB0`, pale wash `#EAF5FB`, border `#BFD9EA`,
  page background `#fafafc`, text `#1d1d1f` / muted `#7a7a7a`.
- White cards, `~18px` radius, soft shadow `0 2px 16px rgba(0,0,0,0.04)`.
- Logged-in view renders `<NavBar />` at the top (consistent with other in-app pages);
  the public view shows a simple ToWin logo + wordmark header instead.
- Generous font sizes (headings ≥ 28px, body ≥ 16px) for elderly readability.

## Testing

- **Manual / Playwright (`webapp-testing`):**
  - `/how-it-works` loads logged-out and logged-in.
  - Next/Back move through all 7 steps; Back disabled on step 1; step 7 shows the CTA.
  - Progress dots jump to any step.
  - Role tab switches Elder ↔ Helper and updates step 2; switching does not reset the step.
  - Logged-in helper defaults to the Helper tab; elder defaults to Elder.
  - All four entry points navigate to `/how-it-works` (Home nav link, Login link, NavBar
    link, in-page recap).
  - Step 7 CTA points to `/register` when logged out and `/dashboard` when logged in.
- **Build:** `npm run build` succeeds with no new warnings.

## Risks / notes

- Content accuracy: must use Trust Score **v2** numbers (tiers 0–2 / 3–14 / 15–49 / 50–119 /
  120+; Profile 8 fields × 0.25). The retired 0–100 formula in the original platform spec
  must **not** be used.
- `MinimalistHero` renders nav links as plain `<a href>`, so repointing `HOW IT WORKS` causes
  a full-page navigation (acceptable — it still lands on the route).
- The page is content-heavy; keeping copy in `guideContent.jsx` prevents `Guide.jsx` from
  growing unfocused.
