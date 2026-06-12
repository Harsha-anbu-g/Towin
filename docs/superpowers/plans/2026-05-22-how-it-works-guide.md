# "How It Works" Guide Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/how-it-works` page — a 7-step guided walkthrough that explains why ToWin exists, what Elders and Helpers can do, and how the Trust Journey, Trust Score, and Streaks work.

**Architecture:** Pure frontend. One page component (`Guide.jsx`) holds navigation behavior (step state, role tab, progress dots, Back/Next). All copy lives in a content module (`guideContent.jsx`) as a `STEPS` array of 7 step objects, each with a `render(ctx)` function. The page is wired as a public route and reached from the Home page, Login page, and (when logged in) the NavBar. No backend changes, no API calls, no tests run against a server — content is static.

**Tech Stack:** React 19 / React Router 7 / inline styles · SF Pro fonts · sky-blue palette (`#4FA3CE`, `#3D8AB0`, `#EAF5FB`, `#BFD9EA`).

**Spec:** `docs/superpowers/specs/2026-05-22-how-it-works-guide-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/data/guideContent.jsx` | NEW — `STEPS` array (7 steps) + small presentational helpers (`Lead`, `SubHead`, `Bullets`, `MiniCard`). All guide copy lives here. |
| `frontend/src/pages/Guide.jsx` | NEW — page shell: header, role tab, progress dots, Back/Next, renders the current step's content inside a white card. |
| `frontend/src/App.jsx` | MODIFY — import `Guide`, add public route `/how-it-works`. |
| `frontend/src/components/NavBar.jsx` | MODIFY — add a "How it works" nav link. |
| `frontend/src/pages/Home.jsx` | MODIFY — repoint the dead `HOW IT WORKS` nav link to `/how-it-works`. |
| `frontend/src/pages/Login.jsx` | MODIFY — add a "How it works" link beside "Share feedback". |

**Note on testing:** the frontend has no unit-test runner. Verification is done with `npm run build` (compile check) and the `webapp-testing` skill (Playwright) against the dev server. There are no TDD steps for this plan.

---

## Chunk 1: Guide Content & Page

### Task 1: Create the content module

**Files:**
- Create: `frontend/src/data/guideContent.jsx`

- [ ] **Step 1: Create the `data` directory and write `guideContent.jsx`**

The `frontend/src/data/` directory does not exist yet — creating the file creates it.

```jsx
// Guide page content — all copy for the /how-it-works walkthrough lives here.
// Guide.jsx renders STEPS[stepIndex].render(ctx) inside a white card.

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BLUE = '#3D8AB0';
const WASH = '#EAF5FB';
const BORDER = '#BFD9EA';

// ── Presentational helpers ───────────────────────────────────────────────

function StepTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: SFD, fontSize: '28px', fontWeight: 700, color: '#1d1d1f',
      letterSpacing: '-0.4px', margin: '0 0 12px', lineHeight: 1.2,
    }}>{children}</h2>
  );
}

function Lead({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '18px', color: '#5a6470',
      lineHeight: 1.6, margin: '0 0 20px',
    }}>{children}</p>
  );
}

function SubHead({ children }) {
  return (
    <h3 style={{
      fontFamily: SFD, fontSize: '19px', fontWeight: 700, color: '#1d1d1f',
      margin: '26px 0 12px',
    }}>{children}</h3>
  );
}

function Bullets({ items }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {items.map((it, i) => (
        <li key={i} style={{
          display: 'flex', gap: '12px', alignItems: 'flex-start',
          fontFamily: SF, fontSize: '16px', color: '#1d1d1f', lineHeight: 1.5,
        }}>
          <span style={{
            flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%',
            background: WASH, border: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
          }}>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.6 6.5L9 1" stroke={BLUE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function MiniCard({ title, children }) {
  return (
    <div style={{
      background: WASH, border: `1px solid ${BORDER}`, borderRadius: '14px',
      padding: '16px 18px',
    }}>
      <p style={{ fontFamily: SFD, fontSize: '16px', fontWeight: 700, color: BLUE, margin: '0 0 6px' }}>
        {title}
      </p>
      <p style={{ fontFamily: SF, fontSize: '15px', color: '#5a6470', lineHeight: 1.55, margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

function CardGrid({ children }) {
  return (
    <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {children}
    </div>
  );
}

function NoteBox({ children }) {
  return (
    <div style={{
      marginTop: '22px', background: '#fafafc', border: '1px solid #e8e8ed',
      borderRadius: '14px', padding: '16px 18px',
      fontFamily: SF, fontSize: '15px', color: '#5a6470', lineHeight: 1.6,
    }}>{children}</div>
  );
}

// ── The 7 steps ──────────────────────────────────────────────────────────
// Each step: { id, navLabel, render(ctx) }
// ctx = { role: 'ELDER'|'HELPER', isLoggedIn: boolean, navigate, restart }

export const STEPS = [
  {
    id: 'welcome',
    navLabel: 'Welcome',
    render: () => (
      <>
        <StepTitle>Welcome to ToWin</StepTitle>
        <Lead>
          ToWin is a community that brings older people and younger helpers together —
          to ease loneliness and make everyday help easy to find.
        </Lead>
        <SubHead>Why we built it</SubHead>
        <p style={{ fontFamily: SF, fontSize: '16px', color: '#1d1d1f', lineHeight: 1.6, margin: 0 }}>
          Many older people have no safe, trusted way to meet new friends or get a hand with
          daily tasks. ToWin gives them one — built around trust that grows one small step
          at a time, so no one ever has to rush or feel unsafe.
        </p>
        <SubHead>Who ToWin is for</SubHead>
        <CardGrid>
          <MiniCard title="Elder">An older person looking for friendship, company, or help with daily tasks.</MiniCard>
          <MiniCard title="Helper">A younger person offering companionship and a hand with everyday things.</MiniCard>
          <MiniCard title="Both">One person can be an Elder and a Helper at the same time.</MiniCard>
        </CardGrid>
        <NoteBox>
          Choose how you'll use ToWin with the tabs above — you can switch between
          Elder and Helper anytime.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'features',
    navLabel: 'What you can do',
    render: ({ role }) => (
      role === 'HELPER' ? (
        <>
          <StepTitle>What you can do as a Helper</StepTitle>
          <Lead>As a Helper, you offer your time and reach the elders who need it most.</Lead>
          <Bullets items={[
            'Browse help requests from elders near you and apply to the ones you can take on.',
            'Discover elders looking for friendship and send a connection request.',
            'Message the elders you connect with, safely and simply.',
            'Grow your Trust Score and earn reviews each time you help.',
          ]} />
          <NoteBox>
            Switch to the <strong>Elder</strong> tab above to see what the experience looks
            like from the other side.
          </NoteBox>
        </>
      ) : (
        <>
          <StepTitle>What you can do as an Elder</StepTitle>
          <Lead>As an Elder, you decide who you connect with and how far the friendship goes.</Lead>
          <Bullets items={[
            'Post a help request — companionship, transport, errands, cleaning, and more.',
            'See the helpers who apply and choose the person you trust.',
            'Find and connect with helpers near you.',
            'Message the people you connect with, safely and simply.',
            'Check in every day to keep your daily streak going.',
            'Add emergency contacts and use the SOS button any time you need help fast.',
          ]} />
          <NoteBox>
            Switch to the <strong>Helper</strong> tab above to see what the experience looks
            like from the other side.
          </NoteBox>
        </>
      )
    ),
  },
  {
    id: 'journey',
    navLabel: 'Trust Journey',
    render: () => (
      <>
        <StepTitle>The Trust Journey</StepTitle>
        <Lead>
          Every connection grows through 7 gentle stages. You only move forward when
          both people agree.
        </Lead>
        <Bullets items={[
          <><strong>1. Just Connected</strong> — see each other's profile and send a connection request.</>,
          <><strong>2. Messaging</strong> — send messages and share photos in a private chat.</>,
          <><strong>3. Phone Ready</strong> — exchange phone numbers and call each other.</>,
          <><strong>4. Video Ready</strong> — have a video call and meet face to face.</>,
          <><strong>5. Verified</strong> — identities are verified and a verified badge appears.</>,
          <><strong>6. Ready to Meet</strong> — plan an in-person visit; emergency contacts are notified.</>,
          <><strong>7. Fully Trusted</strong> — a full, trusted friendship; leave and receive reviews.</>,
        ]} />
        <NoteBox>
          <strong>Both people must confirm every step.</strong> Either person can pause or end
          a connection at any time. Phone numbers and other details are shared only as trust
          grows — there is no rush, and the journey takes as long as you need.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'score',
    navLabel: 'Trust Score',
    render: () => (
      <>
        <StepTitle>Your Trust Score</StepTitle>
        <Lead>
          Trust is earned, not given. Your Trust Score helps everyone feel safe and helps
          elders choose who to rely on.
        </Lead>
        <SubHead>It has three parts</SubHead>
        <CardGrid>
          <MiniCard title="Profile Score">
            Fill in your profile. 8 details — each worth 0.25 points, up to 2.0: ID and phone
            verified, photo, a social link, hobbies, occupation, a short bio, and date of birth.
          </MiniCard>
          <MiniCard title="Rooting Score">
            Earn points every time a relationship moves up a trust stage — added up across all
            of your connections.
          </MiniCard>
          <MiniCard title="Review Score">
            Every star rating you receive from the people you help adds up here.
          </MiniCard>
        </CardGrid>
        <SubHead>The five tiers</SubHead>
        <Bullets items={[
          <><strong>New Member</strong> — 0 to 2 points.</>,
          <><strong>Getting Started</strong> — 3 to 14 points.</>,
          <><strong>Reliable</strong> — 15 to 49 points.</>,
          <><strong>Highly Trusted</strong> — 50 to 119 points.</>,
          <><strong>Community Champion</strong> — 120 points and above.</>,
        ]} />
        <NoteBox>
          After a connection reaches a full friendship, both people leave a 1–5 star rating,
          a few kind tags (Friendly, Punctual, Respectful, Helpful, Patient), and can quietly
          flag a safety concern if something didn't feel right.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'streaks',
    navLabel: 'Streaks',
    render: () => (
      <>
        <StepTitle>Daily Streaks</StepTitle>
        <Lead>
          Showing up matters. Each day you visit ToWin, tap "I'm here today" to log the day.
        </Lead>
        <Bullets items={[
          'Your current streak counts the days you have checked in, one after another.',
          'Your best streak is your all-time record — something to be proud of.',
          'Miss a day and the current streak starts again — but your best streak is always kept.',
        ]} />
        <NoteBox>
          The streak check-in is the first screen elders see after signing in — a simple,
          friendly way to start the day.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'feel',
    navLabel: 'The ToWin feel',
    render: () => (
      <>
        <StepTitle>The ToWin feel</StepTitle>
        <Lead>
          Every screen is designed to feel calm, clear, and unhurried.
        </Lead>
        <Bullets items={[
          'Calm sky-blue colours and soft white cards — never harsh, never cluttered.',
          'The tortoise logo: steady and patient, because trust grows slowly and surely.',
          'Large, readable text so nothing is a strain to read.',
          'One simple thing per screen — no clutter, no confusion.',
        ]} />
      </>
    ),
  },
  {
    id: 'start',
    navLabel: 'Get started',
    render: ({ isLoggedIn, navigate, restart }) => (
      <>
        <StepTitle>You're ready</StepTitle>
        <Lead>
          Build your profile, connect with people near you, grow trust step by step,
          and meet safely. That's ToWin.
        </Lead>
        <button
          onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}
          style={{
            width: '100%', background: SKY, color: '#fff', border: 'none',
            borderRadius: '9999px', padding: '16px 0', fontSize: '17px', fontWeight: 700,
            fontFamily: SF, cursor: 'pointer', marginTop: '8px',
            boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
          }}
        >
          {isLoggedIn ? 'Go to my dashboard' : 'Create your account'}
        </button>
        <button
          onClick={restart}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: SF, fontSize: '14px', color: '#7a7a7a', marginTop: '14px',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          Read the guide again from the start
        </button>
      </>
    ),
  },
];
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd frontend && npm run build`
Expected: BUILD succeeds (Vite output ends with `built in …`), no errors mentioning `guideContent`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/guideContent.jsx
git commit -m "feat: add guide content module for How It Works page"
```

---

### Task 2: Create the Guide page

**Files:**
- Create: `frontend/src/pages/Guide.jsx`

- [ ] **Step 1: Write `Guide.jsx`**

```jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import { STEPS } from '../data/guideContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BLUE = '#3D8AB0';
const WASH = '#EAF5FB';
const BORDER = '#BFD9EA';

// Simple header shown to logged-out visitors (logged-in users get the NavBar).
function PublicHeader() {
  return (
    <header style={{
      background: '#ffffff', height: '72px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 32px', borderBottom: '1px solid #ececef',
    }}>
      <Link to="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        fontFamily: SFD, fontSize: '24px', fontWeight: 800, color: '#1a5c2e',
        letterSpacing: '-0.4px', textDecoration: 'none',
      }}>
        <img src="/logo.png" alt="ToWin logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
        ToWin
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <Link to="/login" style={{ fontFamily: SF, fontSize: '15px', color: '#5a6470', textDecoration: 'none' }}>
          Sign in
        </Link>
        <Link to="/register" style={{
          fontFamily: SF, fontSize: '15px', fontWeight: 600, color: '#fff', background: SKY,
          padding: '9px 20px', borderRadius: '9999px', textDecoration: 'none',
        }}>
          Get started
        </Link>
      </div>
    </header>
  );
}

function RoleTab({ role, setRole }) {
  const Tab = ({ value, label }) => {
    const active = role === value;
    return (
      <button
        onClick={() => setRole(value)}
        style={{
          flex: 1, padding: '12px 0', fontFamily: SF, fontSize: '16px',
          fontWeight: active ? 700 : 500,
          color: active ? '#fff' : '#5a6470',
          background: active ? SKY : '#fff',
          border: `1px solid ${active ? SKY : '#e0e0e0'}`,
          borderRadius: '9999px', cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
      <Tab value="ELDER" label="I'm an Elder" />
      <Tab value="HELPER" label="I'm a Helper" />
    </div>
  );
}

function ProgressDots({ count, current, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to step ${i + 1}`}
            style={{
              width: here ? '26px' : '11px', height: '11px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', padding: 0,
              background: here ? SKY : done ? BORDER : '#e0e0e0',
              transition: 'width 0.2s, background 0.2s',
            }}
          />
        );
      })}
    </div>
  );
}

export default function Guide() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLoggedIn = !!user;

  const [step, setStep] = useState(0);
  const [role, setRole] = useState(user?.role === 'HELPER' ? 'HELPER' : 'ELDER');

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const ctx = { role, isLoggedIn, navigate, restart: () => setStep(0) };

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc' }}>
      {isLoggedIn ? <NavBar /> : <PublicHeader />}

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page heading */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontFamily: SFD, fontSize: '34px', fontWeight: 700, color: '#1d1d1f',
            letterSpacing: '-0.5px', margin: '0 0 8px',
          }}>
            How ToWin Works
          </h1>
          <p style={{ fontFamily: SF, fontSize: '16px', color: '#7a7a7a', margin: 0, lineHeight: 1.5 }}>
            A short, step-by-step tour of the platform. Use Back and Next, or tap a dot to jump.
          </p>
        </div>

        {/* Role tab */}
        <RoleTab role={role} setRole={setRole} />

        {/* Progress */}
        <ProgressDots count={total} current={step} onJump={setStep} />
        <p style={{
          fontFamily: SF, fontSize: '13px', color: '#a0a0a5', textAlign: 'center',
          margin: '0 0 20px',
        }}>
          Step {step + 1} of {total} · {current.navLabel}
        </p>

        {/* Step card */}
        <div style={{
          background: '#fff', borderRadius: '18px', border: '1px solid #e0e0e0',
          padding: '32px 36px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
          minHeight: '320px',
        }}>
          {current.render(ctx)}
        </div>

        {/* Back / Next */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              padding: '13px 28px', fontFamily: SF, fontSize: '16px', fontWeight: 600,
              borderRadius: '9999px', cursor: step === 0 ? 'default' : 'pointer',
              background: '#fff', color: step === 0 ? '#c8c8cd' : '#1d1d1f',
              border: '1px solid #e0e0e0',
            }}
          >
            Back
          </button>
          {!isLast && (
            <button
              onClick={() => setStep(s => Math.min(total - 1, s + 1))}
              style={{
                padding: '13px 32px', fontFamily: SF, fontSize: '16px', fontWeight: 700,
                borderRadius: '9999px', cursor: 'pointer', background: SKY, color: '#fff',
                border: 'none', boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd frontend && npm run build`
Expected: BUILD succeeds, no errors mentioning `Guide`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Guide.jsx
git commit -m "feat: add How It Works guide page shell"
```

---

### Task 3: Wire the public route

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add the import**

In `App.jsx`, after the line `import Feedback from './pages/Feedback';`, add:

```jsx
import Guide from './pages/Guide';
```

- [ ] **Step 2: Add the route**

In the `<Routes>` block, immediately after the line
`<Route path="/feedback" element={<Feedback />} />`, add:

```jsx
<Route path="/how-it-works" element={<Guide />} />
```

This is a public route (no `PrivateRoute` wrapper) — same pattern as `/feedback`.

- [ ] **Step 3: Verify the build**

Run: `cd frontend && npm run build`
Expected: BUILD succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add public /how-it-works route"
```

---

### Task 4: Add the four entry points

**Files:**
- Modify: `frontend/src/components/NavBar.jsx`
- Modify: `frontend/src/pages/Home.jsx`
- Modify: `frontend/src/pages/Login.jsx`

- [ ] **Step 1: Add the NavBar link**

In `NavBar.jsx`, find the nav links row. After the line
`<NavLink to="/trust" label="Trust Score" />`, add:

```jsx
<NavLink to="/how-it-works" label="How it works" />
```

- [ ] **Step 2: Repoint the Home page link**

In `Home.jsx`, the `navLinks` array has a dead anchor. Change:

```jsx
{ label: 'HOW IT WORKS', href: '#how' },
```

to:

```jsx
{ label: 'HOW IT WORKS', href: '/how-it-works' },
```

(`MinimalistHero` renders nav links as plain `<a href>`, so this navigates to the route.)

- [ ] **Step 3: Add the Login page link**

In `Login.jsx`, find the "Share feedback" paragraph near the end:

```jsx
            <p style={{
              textAlign: 'center', fontSize: '13px', color: '#a0a0a5',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              marginTop: '8px',
            }}>
              <Link to="/feedback" style={{ color: '#7a7a7a', textDecoration: 'none' }}>
                Share feedback
              </Link>
            </p>
```

Replace the inner content of that `<p>` so it shows both links:

```jsx
            <p style={{
              textAlign: 'center', fontSize: '13px', color: '#a0a0a5',
              fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
              marginTop: '8px',
            }}>
              <Link to="/how-it-works" style={{ color: '#7a7a7a', textDecoration: 'none' }}>
                How it works
              </Link>
              {'  ·  '}
              <Link to="/feedback" style={{ color: '#7a7a7a', textDecoration: 'none' }}>
                Share feedback
              </Link>
            </p>
```

- [ ] **Step 4: Verify the build**

Run: `cd frontend && npm run build`
Expected: BUILD succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/NavBar.jsx frontend/src/pages/Home.jsx frontend/src/pages/Login.jsx
git commit -m "feat: link How It Works guide from NavBar, Home, and Login"
```

---

### Task 5: Verify in the browser

Use the `webapp-testing` skill (Playwright) against the dev server.

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && npm run dev`
The app serves on `http://localhost:5173`.

- [ ] **Step 2: Verify the logged-out experience**

Navigate to `http://localhost:5173/how-it-works` and check:
- The `PublicHeader` shows (ToWin logo, "Sign in", "Get started") — not the in-app NavBar.
- Page heading "How ToWin Works" and the role tab are visible.
- "Step 1 of 7 · Welcome" shows; Back is disabled (greyed); Next is the blue button.
- Clicking **Next** moves through all 7 steps; on step 7 the Next button is gone and the
  card shows the "Create your account" CTA (because logged out).
- Clicking a **progress dot** jumps directly to that step.
- On step 2, switching the role tab toggles between "What you can do as an Elder" and
  "…as a Helper"; switching does NOT change the step number.
- Step 7 → "Create your account" navigates to `/register`.
- "Read the guide again from the start" returns to step 1.

- [ ] **Step 3: Verify the entry points (logged out)**

- On `http://localhost:5173/` (Home), click the **HOW IT WORKS** nav link → lands on `/how-it-works`.
- On `http://localhost:5173/login`, click the **How it works** link → lands on `/how-it-works`.

- [ ] **Step 4: Verify the logged-in experience**

Log in as an Elder, then navigate to `/how-it-works`:
- The in-app **NavBar** shows at the top (with the new "How it works" link).
- The role tab defaults to **"I'm an Elder"**.
- Step 7's CTA reads **"Go to my dashboard"** and navigates to `/dashboard`.

Log in as a Helper, then navigate to `/how-it-works`:
- The role tab defaults to **"I'm a Helper"** and step 2 shows the Helper content first.

- [ ] **Step 5: Final build check**

Run: `cd frontend && npm run build`
Expected: BUILD succeeds with no new warnings.

---

## Final Verification Checklist

- [ ] `/how-it-works` loads logged-out (PublicHeader) and logged-in (NavBar).
- [ ] All 7 steps render; Back disabled on step 1; Next hidden on step 7.
- [ ] Progress dots jump to any step.
- [ ] Role tab switches Elder ↔ Helper, updates step 2, and does not reset the step.
- [ ] Logged-in Helper defaults to the Helper tab; Elder/Both default to Elder.
- [ ] Step 7 CTA → `/register` (logged out) or `/dashboard` (logged in).
- [ ] All four entry points reach `/how-it-works`: Home nav link, Login link, NavBar link, in-page restart.
- [ ] `npm run build` succeeds with no new warnings.
