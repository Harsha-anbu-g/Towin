# Night Mode (Dark Theme) Implementation Plan

> **For agentic workers:** Executed inline via superpowers:executing-plans (single session — the
> hex-migration judgment must stay consistent across ~25 files). **No commits until the user has
> reviewed on localhost** (per the user's standing review workflow, which overrides per-step
> commits). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opt-in "Night mode" across the whole app — a `[data-theme="dark"]` token layer, a
persisted toggle in the NavBar, and migration of inline hardcoded hexes to tokens so every
screen renders correctly in both themes. Light mode stays pixel-identical.

**Architecture:** All theme-dependent color flows through CSS custom properties in
`frontend/src/index.css`. One `[data-theme="dark"]` block re-maps them (spec:
`docs/superpowers/specs/2026-07-05-night-mode-design.md`). An inline script in `index.html`
applies the saved theme pre-paint; `ThemeContext` owns it after mount; NavBar renders the
toggle. Inline JSX hexes migrate to `var(--token)` per the role-based mapping table.

**Tech Stack:** React 19, Vite, Tailwind v4 (tokens only — no `dark:` variants), vitest, lucide-react.

---

## Chunk 1: Infrastructure

### Task 1: Dark token layer in `index.css`

**Files:** Modify `frontend/src/index.css` (token block ~L19–100, plus targeted rule overrides)

- [x] Add `color-scheme: light` to `:root`; append the `[data-theme="dark"]` block with every
      override from the spec table, plus `color-scheme: dark`.
- [x] Mint alias tokens (same light value, dark override) for recurring literals:
      `--hairline #f0f0f0 → #33312d`, `--hairline-2 #e0e0e0 → #3a3833`,
      `--sky-line #dcebf4 → rgba(79,163,206,.30)`, `--sky-line-2 #d8eaf4 → rgba(79,163,206,.26)`,
      `--sky-ghost #f4fafd → rgba(79,163,206,.07)`, `--green-wash #f0fdf4 → rgba(61,139,90,.12)`,
      `--green-line #bfe0c9 → rgba(124,194,143,.38)`, `--red-line #fecaca → rgba(248,113,113,.35)`,
      `--gold-wash #fbeed9 → rgba(201,164,104,.14)`, `--gold-line #fde68a → rgba(201,164,104,.40)`,
      `--gold-deep #7a5b1e → #d4b478`, `--grey-fill #f5f5f7 → #2e2d2b`,
      `--grey-fill-2 #f3f4f6 → #2e2d2b`, `--grey-line #e5e7eb → #3a3833`,
      `--star-gold #f5b400 → #f5b400` (stars stay lit), `--btn-disabled #94a3b8 → #55534f`.
- [x] Night overrides for stylesheet literals: `::selection`, `.auth-form` gradient,
      `.register-title` color → `var(--ink)`, `.shimmer-btn`/`.primary-btn` disabled grey →
      `var(--btn-disabled)`, `.lift:hover` shadow, `.ghost-btn:hover` background.
- [x] `.streaks-tortoise` helper class: `mix-blend-mode: multiply` in light,
      `normal` + `filter: brightness(1.05)` under dark (Streaks.jsx swaps its inline
      `mixBlendMode` for this class).

### Task 2: Pre-paint theme script + ThemeContext

**Files:** Modify `frontend/index.html`; Create `frontend/src/context/ThemeContext.jsx`;
Modify `frontend/src/App.jsx` (wrap providers); Test `frontend/src/context/ThemeContext.test.jsx`

- [x] `index.html` head, before the stylesheet links:
      ```html
      <script>
        try { if (localStorage.getItem('towin-theme') === 'dark')
          document.documentElement.dataset.theme = 'dark'; } catch (e) {}
      </script>
      ```
- [x] `ThemeContext.jsx`: `ThemeProvider` + `useTheme()` → `{ theme, toggleTheme }`.
      Reads initial value from `document.documentElement.dataset.theme`; writes
      `dataset.theme`, `localStorage`, and syncs `<meta name="theme-color">`
      (`#4FA3CE` light / `#201f1d` dark).
- [x] Write failing test first: default light; toggle sets `data-theme="dark"` + persists;
      re-mount restores dark. Run `npx vitest run src/context/ThemeContext.test.jsx` → fails
      (no module) → implement → passes.
- [x] Wrap app in `<ThemeProvider>` in `App.jsx`.

### Task 3: NavBar toggle + NavBar migration

**Files:** Modify `frontend/src/components/NavBar.jsx`

- [x] Account dropdown row above "Log out": Moon icon + "Night mode" + switch
      (`role="switch"`, `aria-checked`, 44px min target, knob = `transform` 160ms ease-out,
      no bounce). Same row in the mobile drawer.
- [x] Migrate NavBar inline hexes per the mapping table (nav `#ffffff → var(--canvas)`,
      drawer bg, `#f0f0f0 → var(--hairline)`, `#5a6470 → var(--ink-slate)`,
      `#1d1d1f → var(--ink)`, `#4FA3CE → var(--blue)`, trust-gold pill → `var(--trust-gold)`
      + wash tokens; white-on-filled stays `#fff`).

## Chunk 2: Token migration (role-based, file by file)

**Global mapping (applies to every file):**

| Literal (as bg/border/text-on-light) | Token |
|---|---|
| `#ffffff`/`#fff`/`white` as surface | `var(--canvas)` |
| `#fff` as text/icon on filled blue/red/green | stays `#fff` |
| `#1d1d1f` | `var(--ink)` · `#333` → `var(--ink-2)` |
| `#5a6470` | `var(--ink-slate)` · `#3a4450` → `var(--ink-slate-dark)` |
| `#7a7a7a` → `var(--ink-3)` · `#a0a0a5`/`#c8c8cd` → `var(--ink-4)` |
| `#4fa3ce` → `var(--blue)` · `#2e7da6` → `var(--blue-deep)` · `#3d8ab0` → `var(--blue-teal)` · `#7bb8d6` → `var(--blue-mid)` |
| `#eaf5fb` → `var(--blue-wash)` · `#e6f2fa` → `var(--blue-tint)` · `#bfd9ea` → `var(--blue-soft)` |
| `#9c7a3c` → `var(--trust-gold)` · `#1a5c2e` → `var(--green-deep)` · `#ebf6ee` → `var(--green-tint)` |
| `#cc0000` → `var(--red)` · `#dc2626` → `var(--red-error)` · `#9b3535` → `var(--red-deep)` (as bg with white text: keep token — dark value stays loud) |
| `#fef2f2` → `var(--red-tint)` · `#fca5a5` → `var(--red-soft)` · alias tokens per Task 1 for the rest |
| `rgba(0,0,0,…)` scrims/shadows | keep |
| one-off decorative hexes | judge in place; if theme-dependent, nearest role token |

- [x] **Batch A (shared):** ConfirmDialog, SegmentedTabs, GlassTab, TrustBadge, TrustJourney,
      SiteFooter, BetaBanner, FeedbackWidget, AskAiAssistant, VerifyBanner, SmoothInput,
      TagInput, CookieConsent, LocationPrimer, LocationPrompt, PeekabooCard, TurtleLogo,
      components/ui + components/magic
- [x] **Batch B (core pages):** ElderDashboard, HelperDashboard, Streaks (+ blend-mode class
      swap), Trust, Messages, MessagesInbox
- [x] **Batch C (auth/public):** Landing, Login, Register, FinishSetup, OAuthCallback,
      VerifyEmail, VerifyPending, CheckEmail, ForgotPassword, ResetPassword, Guide, Privacy,
      Terms, Feedback
- [x] **Batch D (rest):** ProfileEdit, ChangePassword, EmergencyContacts, UserProfile, Admin,
      PeekabooGame
- [x] After each batch: `grep -cE '#[0-9a-fA-F]{3,8}' <files>` — remaining hits are only
      whitelisted literals (white-on-filled, scrims, brand-fixed).

## Chunk 3: Verification

- [x] `npm run test:run` — full suite green.
- [x] `npm run build` — clean.
- [x] Playwright against `npm run dev`: Login, Register, Landing, Streaks, Elder dashboard,
      Trust, Messages, ProfileEdit in **both** themes; screenshot review for unreadable
      text / stray light patches / broken blend modes. Light mode must look unchanged.
- [x] Update `DESIGN.md` (theme section: night-mode amendment + token table pointer).
- [x] Present on localhost for user review. **Do not commit or push until approval.**
