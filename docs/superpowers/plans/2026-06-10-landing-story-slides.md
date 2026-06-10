# Landing Story Slides Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the straight-to-login entry at `/` with a 6-slide story that tells visitors what ToWin is and why it exists, ending in a Start button that lands on the existing login page.

**Architecture:** One new page (`Landing.jsx`) follows the existing `Guide.jsx` pattern — a `useState` slide index, progress dots, pill Back/Next buttons, and all copy in a separate data file (`landingContent.jsx`, mirroring `guideContent.jsx`). Slide entry animation reuses the existing `.bf` blur-fade CSS classes (no framer-motion needed). Routing: `/` switches from a redirect to `<PublicRoute><Landing /></PublicRoute>` so logged-in users still skip to their dashboard; `BfCacheGuard` learns that `/` is public.

**Tech Stack:** React 19, react-router-dom 7, inline styles + small media-query overrides in `index.css` (the project idiom), Vite dev server, Playwright (webapp-testing) for verification.

**Spec:** `docs/superpowers/specs/2026-06-10-landing-onboarding-design.md`

**Conventions to follow (read these files first):**
- `frontend/src/data/guideContent.jsx` — data-file pattern: exported array of `{ id, render }` plus local presentational helpers, SF font constants, palette constants.
- `frontend/src/pages/Guide.jsx` — step shell pattern: dots, Back/Next pills, disabled-Back styling.
- `frontend/src/index.css` lines 138–146 (`.bf` animation classes) and lines 398–416 (`.auth-*` media-query pattern: base styles inline, mobile overrides in CSS with `!important`).
- Git: commit messages are plain conventional commits, **no Co-Authored-By or generated-with footers**.

---

## Chunk 1: All tasks

### Task 1: Slide content data file

**Files:**
- Create: `frontend/src/data/landingContent.jsx`

- [ ] **Step 1: Create `frontend/src/data/landingContent.jsx` with this exact content**

```jsx
// Landing story — all copy for the / entry slides lives here.
// Landing.jsx renders SLIDES[index].render() inside the slide shell.
// Helpers here are hero-scale (bigger type than guideContent's card-scale).

import TurtleLogo from '../components/TurtleLogo';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const BLUE = '#3D8AB0';
const WASH = '#EAF5FB';
const BORDER = '#BFD9EA';

// ── Presentational helpers ───────────────────────────────────────────────

function Kicker({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '13px', fontWeight: 700, color: BLUE,
      letterSpacing: '1.5px', textTransform: 'uppercase',
      textAlign: 'center', margin: '0 0 10px',
    }}>{children}</p>
  );
}

function Title({ children }) {
  return (
    <h1 className="landing-title" style={{
      fontFamily: SFD, fontSize: '38px', fontWeight: 700, color: '#1d1d1f',
      letterSpacing: '-0.5px', lineHeight: 1.15, textAlign: 'center',
      margin: '0 0 14px',
    }}>{children}</h1>
  );
}

function Lead({ children }) {
  return (
    <p className="landing-lead" style={{
      fontFamily: SF, fontSize: '19px', color: '#5a6470', lineHeight: 1.6,
      textAlign: 'center', maxWidth: '540px', margin: '0 auto 22px',
    }}>{children}</p>
  );
}

function Body({ children }) {
  return (
    <p style={{
      fontFamily: SF, fontSize: '17px', color: '#1d1d1f', lineHeight: 1.65,
      textAlign: 'center', maxWidth: '540px', margin: '0 auto 16px',
    }}>{children}</p>
  );
}

function MiniCard({ title, children }) {
  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px',
      padding: '18px 20px', textAlign: 'left',
    }}>
      <p style={{ fontFamily: SFD, fontSize: '17px', fontWeight: 700, color: BLUE, margin: '0 0 6px' }}>
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
    <div className="landing-cards" style={{
      display: 'grid', gap: '14px', maxWidth: '600px', margin: '0 auto',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    }}>{children}</div>
  );
}

function StageChips({ stages }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center',
      maxWidth: '560px', margin: '0 auto',
    }}>
      {stages.map((s, i) => (
        <span key={s} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: WASH, border: `1px solid ${BORDER}`, borderRadius: '9999px',
          padding: '9px 16px', fontFamily: SF, fontSize: '15px', color: '#1d1d1f',
        }}>
          <span style={{ fontWeight: 700, color: BLUE }}>{i + 1}</span>
          {s}
        </span>
      ))}
    </div>
  );
}

function NoteBox({ children }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e8e8ed',
      borderRadius: '14px', padding: '16px 20px', maxWidth: '540px',
      margin: '22px auto 0', fontFamily: SF, fontSize: '15px',
      color: '#5a6470', lineHeight: 1.6, textAlign: 'center',
    }}>{children}</div>
  );
}

// ── The 6 slides ─────────────────────────────────────────────────────────
// Each slide: { id, nextLabel?, render() }
// The shell shows nextLabel on the Next button (default "Next");
// on the last slide the shell shows the Start button instead.

export const SLIDES = [
  {
    id: 'welcome',
    nextLabel: 'See why →',
    render: () => (
      <>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <TurtleLogo size={76} />
        </div>
        <Title>ToWin</Title>
        <Lead>Where two generations win together.</Lead>
        <Body>
          A calm, safe place where older people and young helpers meet —
          and both walk away with more.
        </Body>
      </>
    ),
  },
  {
    id: 'people',
    render: () => (
      <>
        <Kicker>Who it&apos;s for</Kicker>
        <Title>Two kinds of people</Title>
        <Lead>
          Everyone on ToWin is one of two roles. You choose yours when you
          create your account.
        </Lead>
        <CardGrid>
          <MiniCard title="Elder">
            An older person looking for friendship, company, or help with daily tasks.
          </MiniCard>
          <MiniCard title="Helper">
            A younger person offering companionship and a hand with everyday things.
          </MiniCard>
        </CardGrid>
      </>
    ),
  },
  {
    id: 'solves',
    render: () => (
      <>
        <Kicker>The problem we solve</Kicker>
        <Title>Help is hard to find alone</Title>
        <Lead>
          Everyday things — errands, a lift, a little company — take energy
          that elders don&apos;t always have.
        </Lead>
        <Body>
          On ToWin, an elder simply asks. Helpers nearby see the request and
          step in — for whatever is needed.
        </Body>
      </>
    ),
  },
  {
    id: 'trust',
    render: () => (
      <>
        <Kicker>The real problem is trust</Kicker>
        <Title>Trust is earned, not given</Title>
        <Lead>
          Letting someone new into your life is a big step. So every member
          has a Trust Score, built from three things:
        </Lead>
        <CardGrid>
          <MiniCard title="Profile">
            A complete, verified profile — ID, phone, photo and more.
          </MiniCard>
          <MiniCard title="Rooting">
            Points earned each time a relationship takes a step forward.
          </MiniCard>
          <MiniCard title="Review">
            Star ratings from the people they have already helped.
          </MiniCard>
        </CardGrid>
        <NoteBox>Elders see a helper&apos;s Trust Score before they ever say yes.</NoteBox>
      </>
    ),
  },
  {
    id: 'rooting',
    render: () => (
      <>
        <Kicker>One step at a time</Kicker>
        <Title>Rooting — how trust grows</Title>
        <Lead>
          Like a tree growing roots, every connection on ToWin deepens slowly,
          through 7 gentle stages:
        </Lead>
        <StageChips stages={[
          'Just Connected', 'Messaging', 'Phone Ready', 'Video Ready',
          'Verified', 'Ready to Meet', 'Fully Trusted',
        ]} />
        <NoteBox>
          <strong>Both people must agree to every step.</strong> Nothing personal —
          like a phone number — is shared until trust has grown.
        </NoteBox>
      </>
    ),
  },
  {
    id: 'why',
    render: () => (
      <>
        <Kicker>Why ToWin</Kicker>
        <Title>Both sides win</Title>
        <Body>
          Today&apos;s elders use phones, shop online, and pay online — and
          tomorrow there will be many more.
        </Body>
        <Body>
          But the hardest parts of growing older haven&apos;t changed:
          loneliness, and not enough energy for everyday things.
        </Body>
        <NoteBox>
          Elders have <strong>time and money</strong>, but need energy and company.{' '}
          Helpers have <strong>energy and time</strong>, but need money and warmth.{' '}
          <strong>ToWin is where they exchange — and both win.</strong>
        </NoteBox>
      </>
    ),
  },
];
```

- [ ] **Step 2: Verify it lints**

Run: `cd /Users/aghar/Documents/Projects/ToWin/frontend && npx eslint src/data/landingContent.jsx`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/landingContent.jsx
git commit -m "feat: add landing story slide content"
```

### Task 2: Landing page shell + responsive CSS

**Files:**
- Create: `frontend/src/pages/Landing.jsx`
- Modify: `frontend/src/index.css` (append at end of file)

- [ ] **Step 1: Create `frontend/src/pages/Landing.jsx` with this exact content**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import TurtleLogo from '../components/TurtleLogo';
import { SLIDES } from '../data/landingContent';

const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';
const BORDER = '#BFD9EA';

function ProgressDots({ count, current, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const done = i < current;
        const here = i === current;
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to slide ${i + 1}`}
            style={{
              width: here ? '26px' : '11px', height: '11px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', padding: 0,
              background: here ? SKY : done ? BORDER : '#dfe6ec',
              transition: 'width 0.2s, background 0.2s',
            }}
          />
        );
      })}
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const total = SLIDES.length;
  const slide = SLIDES[index];
  const isLast = index === total - 1;

  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      background:
        'radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.8) 0%, transparent 55%),' +
        'linear-gradient(165deg, #F4FAFD 0%, #EAF5FB 55%, #D9EBF5 100%)',
    }}>
      {/* Top bar: brand left, escape hatch right */}
      <header className="landing-topbar" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '9px',
          fontFamily: SFD, fontSize: '21px', fontWeight: 800, color: '#1d1d1f',
          letterSpacing: '-0.3px',
        }}>
          <TurtleLogo size={34} />
          ToWin
        </span>
        <Link to="/login" style={{
          fontFamily: SF, fontSize: '15px', fontWeight: 600, color: SKY,
          textDecoration: 'none', padding: '14px 6px',
        }}>
          Already a member? Log in
        </Link>
      </header>

      {/* Slide content — key remounts the wrapper so .bf re-animates per slide */}
      <main className="landing-main" style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 40px',
      }}>
        <div key={slide.id} className="bf" style={{ width: '100%', maxWidth: '680px' }}>
          {slide.render()}
        </div>
      </main>

      {/* Footer: dots + navigation */}
      <footer className="landing-footer" style={{ padding: '0 40px 36px' }}>
        <ProgressDots count={total} current={index} onJump={setIndex} />
        <p style={{
          fontFamily: SF, fontSize: '13px', color: '#a0a0a5',
          textAlign: 'center', margin: '10px 0 18px',
        }}>
          {index + 1} of {total}
        </p>

        {isLast ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                minWidth: '260px', height: '54px', background: SKY, color: '#fff',
                border: 'none', borderRadius: '9999px', cursor: 'pointer',
                fontFamily: SF, fontSize: '18px', fontWeight: 700,
                boxShadow: '0 6px 20px rgba(79,163,206,0.4)',
              }}
            >
              Start
            </button>
            <div style={{ display: 'flex', gap: '22px', alignItems: 'center' }}>
              <button
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: SF, fontSize: '15px', fontWeight: 600,
                  color: '#5a6470', padding: '8px 4px',
                }}
              >
                Back
              </button>
              <Link to="/how-it-works" style={{
                fontFamily: SF, fontSize: '15px', fontWeight: 600,
                color: SKY, textDecoration: 'none', padding: '8px 4px',
              }}>
                Read the full guide
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: '12px',
            maxWidth: '480px', margin: '0 auto',
          }}>
            <button
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={index === 0}
              style={{
                padding: '13px 28px', fontFamily: SF, fontSize: '16px', fontWeight: 600,
                borderRadius: '9999px', cursor: index === 0 ? 'default' : 'pointer',
                background: '#fff', color: index === 0 ? '#c8c8cd' : '#1d1d1f',
                border: '1px solid #e0e0e0',
              }}
            >
              Back
            </button>
            <button
              onClick={() => setIndex(i => Math.min(total - 1, i + 1))}
              style={{
                padding: '13px 32px', fontFamily: SF, fontSize: '16px', fontWeight: 700,
                borderRadius: '9999px', cursor: 'pointer', background: SKY, color: '#fff',
                border: 'none', boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
              }}
            >
              {slide.nextLabel || 'Next'}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Append the responsive overrides to the end of `frontend/src/index.css`**

```css
/* ── Landing story slides ─────────────────────────────────────────────── */
@media (max-width: 640px) {
  .landing-topbar { padding: 14px 18px !important; }
  .landing-main   { padding: 16px 20px !important; }
  .landing-footer { padding: 0 20px 28px !important; }
  .landing-title  { font-size: 29px !important; }
  .landing-lead   { font-size: 17px !important; }
  .landing-cards  { grid-template-columns: 1fr !important; }
}
```

- [ ] **Step 3: Verify it lints**

Run: `cd /Users/aghar/Documents/Projects/ToWin/frontend && npx eslint src/pages/Landing.jsx`
Expected: no output (exit 0).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Landing.jsx frontend/src/index.css
git commit -m "feat: add landing story slides page"
```

### Task 3: Wire `/` route and bfcache guard

**Files:**
- Modify: `frontend/src/App.jsx` (imports block at top; `BfCacheGuard` ~line 32; routes ~line 83)

- [ ] **Step 1: Add the import** (after the `Login` import at the top of `App.jsx`)

```jsx
import Landing from './pages/Landing';
```

- [ ] **Step 2: Replace the `/` route.** Change:

```jsx
<Route path="/" element={<Navigate to="/login" replace />} />
```

to:

```jsx
<Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
```

(`PublicRoute` already redirects logged-in users to `/dashboard`, admins to `/admin`.)

- [ ] **Step 3: Mark `/` public in `BfCacheGuard`.** Change:

```jsx
const isPublic = path === '/login' || path === '/register';
```

to:

```jsx
const isPublic = path === '/' || path === '/login' || path === '/register';
```

Note: the existing guard logs out a logged-in user when a public page is
restored from bfcache — that behavior now correctly covers `/` too, matching
how `/login` is treated. Leave the `*` catch-all route pointing at `/login`
(returning users' intent, per spec).

- [ ] **Step 4: Verify it lints**

Run: `cd /Users/aghar/Documents/Projects/ToWin/frontend && npx eslint src/App.jsx`
Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: route / to landing story slides"
```

### Task 4: Browser verification — desktop and mobile

Use the webapp-testing skill (Playwright). The landing page is fully static —
the backend is NOT required for any check below (the logged-in redirect is
verified with a hand-crafted token, since `AuthContext.parseJwtPayload` only
base64-decodes the payload and never verifies the signature).

- [ ] **Step 1: Start the frontend dev server (background)**

Run: `cd /Users/aghar/Documents/Projects/ToWin/frontend && npm run dev`
Expected: Vite ready on `http://localhost:5173`.

- [ ] **Step 2: Desktop walkthrough (viewport 1280×800)**

Navigate to `http://localhost:5173/` and verify:
- Slide 1 shows the turtle logo, "ToWin", "Where two generations win together," and a "See why →" button. Back is disabled.
- Click through all 6 slides with Next. Check per slide: 2 = Elder + Helper cards side by side; 3 = "Help is hard to find alone"; 4 = three Trust Score cards in a row; 5 = seven stage chips; 6 = "Both sides win" with a large Start button, a Back text button, and a "Read the full guide" link.
- Dots: 6 dots, current one elongated; clicking dot 1 jumps back to slide 1.
- Take a screenshot of each slide → `docs/screenshots/landing-desktop-<n>.png`.

- [ ] **Step 3: Desktop link checks**

- On slide 6, click **Start** → URL becomes `/login` and the login form renders.
- Browser Back → returns to landing. Click "Already a member? Log in" in the top bar → `/login` again.

- [ ] **Step 4: Logged-in redirect check**

In the browser console run:

```js
localStorage.setItem('token', 'x.' + btoa(JSON.stringify({ role: 'HELPER', sub: '1' })) + '.x');
```

Navigate to `http://localhost:5173/` → URL must immediately become `/dashboard`
(the dashboard may show a loading/error state without the backend — only the
redirect is being asserted). Then clean up:

```js
localStorage.removeItem('token');
```

- [ ] **Step 5: Mobile walkthrough (viewport 390×844)**

Repeat the slide walkthrough and verify:
- No horizontal scrolling on any slide.
- Cards stack in a single column on slides 2 and 4.
- Title/lead use the smaller sizes; top bar fits brand + log-in link on one line.
- Take a screenshot of each slide → `docs/screenshots/landing-mobile-<n>.png`.

- [ ] **Step 6: Fix anything that fails, re-verify, then commit screenshots**

```bash
git add docs/screenshots/landing-desktop-*.png docs/screenshots/landing-mobile-*.png
git commit -m "test: landing slides desktop + mobile verification screenshots"
```

- [ ] **Step 7: Final check & merge expectation**

All four tasks committed on `main` (project convention: work lands on `main`
and is pushed). Run `git push origin main` after the user has seen the result,
per the always-merge-to-main convention.
