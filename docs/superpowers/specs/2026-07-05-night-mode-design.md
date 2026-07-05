# Night Mode (Dark Theme) — Design

**Date:** 2026-07-05 · **Status:** implemented pending user review · **Requested by:** user ("make a night more or dark mode option")

## Goal

An opt-in **Night mode** for the whole app. Light (warm parchment) stays the default and the
brand look; night mode is a comfort option the user turns on themselves — useful for evening
use and light sensitivity, both real needs for older adults.

This deliberately amends DESIGN.md's "Never dark canvas" rule: that rule now applies to the
**default** theme only. Brand hues stay locked; night mode re-maps *surfaces and ink*, and
lightens brand hues only where WCAG contrast on dark demands it (same hue families).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Activation | Manual toggle only, persisted in `localStorage("towin-theme")` | Default must stay light. Elderly UX favors predictability — no surprise auto-switching from OS `prefers-color-scheme`. |
| Toggle placement | NavBar account dropdown + mobile drawer, row labeled **"Night mode"** with moon icon and a switch | Discoverable next to Profile/Log out; 44px tap target; simple everyday words. |
| Mechanism | `data-theme="dark"` on `<html>`, set pre-paint by an inline script in `index.html`; React `ThemeContext` owns state after mount | No flash of wrong theme (FOUC); one source of truth. |
| Theme swap motion | Instant swap, no global transition | Emil rules: theme changes are infrequent but global — cross-fading every property janks. The switch knob itself animates (`transform`, 160ms, ease-out). |
| Native UI | `color-scheme: light` on `:root`, `dark` under `[data-theme="dark"]` | Scrollbars, form controls, keyboards render correctly. |
| `<meta name="theme-color">` | Synced by ThemeContext | Browser chrome matches the canvas. |

## Approaches considered

1. **Token overrides + migrate inline hexes to tokens** — *chosen.* All theme-dependent color
   already flows (or will flow) through `:root` custom properties; a single
   `[data-theme="dark"]` block re-maps them. Inline styles can't be overridden by CSS, so the
   ~500 hardcoded hexes in JSX migrate to `var(--token)` references. Light mode stays
   pixel-identical because every literal maps to a token **with the same light value** (new
   alias tokens are minted where no existing token matches exactly).
2. **`filter: invert()` hack** — rejected: off-brand colors, photos need re-inverting, breaks
   the locked palette, hacky.
3. **Per-component dark classes / duplicate styles** — rejected: unmaintainable duplication.
4. **Follow `prefers-color-scheme` only** — rejected: no user control, and the default must
   remain light.

## Night token spec

Warm dark (charcoal with the same warm cast as the parchment) — never blue-black, zen/calm.
Elevation stays "surface contrast + hairlines": cards sit **lighter** than the page.

| Token | Light | Night | Note |
|---|---|---|---|
| `--surface` (page) | `#f6f4ef` | `#201f1d` | warm near-black |
| `--canvas` (cards) | `#ffffff` | `#2a2927` | lighter than page = elevation |
| `--surface-2` | `#f1eee8` | `#262523` | |
| `--surface-pearl` | `#fbfaf6` | `#232220` | |
| `--border` / `--border-soft` | `#e5e1d9` / `#efebe3` | `#3a3833` / `#33312d` | warm hairlines |
| `--ink` / `-2` / `-3` / `-4` | `#1d1d1f` / `#333` / `#7a7a7a` / `#a0a0a5` | `#f2f0ec` / `#ddd9d2` / `#a8a49c` / `#8a867e` | body ≈15:1 on page |
| `--ink-slate` / `-dark` / `--slate` | `#5a6470` / `#3a4450` / `#718096` | `#aeb6bf` / `#c6ccd4` / `#98a4b2` | |
| `--blue` | `#4FA3CE` | `#4FA3CE` | brand action blue reads well on dark — unchanged |
| `--blue-deep` / `--blue-teal` | `#2E7DA6` / `#3D8AB0` | `#7ec0e4` / `#6fb4d8` | text-on-light roles need lighter blue on dark |
| `--blue-tint` / `--blue-wash` | `#E6F2FA` / `#EAF5FB` | `rgba(79,163,206,.16)` / `rgba(79,163,206,.10)` | fills become translucent sky |
| `--blue-soft` | `#BFD9EA` | `rgba(79,163,206,.42)` | borders on sky surfaces |
| `--trust-gold` | `#9C7A3C` | `#c9a468` | same gold family, AA on dark |
| `--green-deep` / `--green-tint` | `#1a5c2e` / `#ebf6ee` | `#7cc28f` / `rgba(61,139,90,.18)` | |
| `--red` / `--red-error` / `--red-deep` | `#cc0000` / `#dc2626` / `#9b3535` | `#ff6b5e` / `#f87171` / `#b45050` | SOS/danger stay loud |
| `--red-tint` / `--red-soft` | `#fef2f2` / `#fca5a5` | `rgba(220,38,38,.16)` / `rgba(248,113,113,.45)` | |
| `--amber` | `#b05000` | `#e0954e` | |
| `--slate-tint` / `--slate-soft` | `#EEF1F4` / `#D7DCE2` | `#33363b` / `#4a4e55` | avatars / neutral chips |

New alias tokens minted for recurring inline literals (same light value, night override):
`--hairline` `#f0f0f0`→`#33312d`, `--hairline-2` `#e0e0e0`→`#3a3833`, plus role tokens for the
remaining tint families (`#dcebf4`, `#d8eaf4`, `#f4fafd`, `#f0fdf4`, `#bfe0c9`, `#fecaca`,
`#fde68a`, `#fbeed9`, `#f5f5f7`, `#f3f4f6`, `#e5e7eb` …) mapped case-by-case during migration.

**Stays literal (identical in both themes):** white text/icons on filled blue/red/green
buttons, the brand blue fill itself, overlay scrims `rgba(0,0,0,…)`, photos.

## Migration policy (inline hex → token)

Role-based, not find-and-replace: a `#fff` that is a *card background* becomes
`var(--canvas)`; a `#fff` that is *text on a blue button* stays `#fff`. Files: all
`src/pages/*.jsx`, shared components, and stylesheet-level literals in `index.css`
(auth-form gradient, `::selection`, `.register-title`, disabled button greys get night
overrides in CSS rather than new tokens where they're single-use).

## Special cases

- **Streaks tortoise** `mixBlendMode: 'multiply'` goes black on dark → `normal` blend +
  slight brightness lift under `[data-theme="dark"]` (via a CSS class, not inline).
- **Auth form gradient** (`.auth-form`) gets a night twin: same radial composition, sky/leaf
  glows at low alpha over the night surface.
- **Account dropdown / drawer shadows**: shadows stay (on dark they need slightly higher
  alpha to read) — night override in CSS.
- **`::selection`**: night override to a slate that keeps ink readable.
- **Hero photos**: unchanged in v1 (no dimming).

## Testing

- Vitest: ThemeContext unit test — default light, toggle flips `data-theme` + persists,
  re-mount restores.
- Existing suite must stay green.
- Playwright on localhost: key pages (Login, Streaks, Dashboard, Trust, Messages) in both
  themes, checking for unreadable text / stray light patches.

## Non-goals

- No auto-switch by OS setting or schedule (may revisit after user feedback).
- No dark OG/marketing images; no per-page theming.
