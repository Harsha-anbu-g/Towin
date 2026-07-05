# Design

Visual system for ToWin ("editorial tech journal on warm paper"). Source of truth for tokens: `frontend/src/index.css`. User-approved 2026-07-05.

## Theme

Light, warm, editorial. Warm parchment canvas with white cards; elevation via hairline borders and surface contrast — **no drop shadows** on cards. A whisper of sky in page-level gradients. Never dark canvas.

## Color

Brand hues are **locked** (see memory/brand rules). Sky-blue is reserved for actions.

| Token | Value | Role |
|---|---|---|
| `--blue` | `#4FA3CE` | Primary actions, links, focus, active trail |
| `--blue-deep` / teal | `#2E7DA6` / `#3D8AB0` | Action text on light, wordmark |
| `--blue-tint` / wash | `#E6F2FA` / `#EAF5FB` | Info fills, trust-chip fills |
| `--blue-soft` | `#BFD9EA` | Borders on sky-tinted surfaces |
| Leaf green | `#7BC893` / `#3D8B5A` | Success accents / success text |
| `--trust-gold` | `#9C7A3C` | The word "trust", trust badges, stars |
| `--green-deep` | `#1a5c2e` | Achieved/trusted badge |
| `--canvas` | `#ffffff` | Cards |
| `--surface` | `#f6f4ef` | Page canvas (warm parchment) |
| `--surface-2` / pearl | `#f1eee8` / `#fbfaf6` | Secondary fills |
| `--border` / soft | `#e5e1d9` / `#efebe3` | Hairlines (the elevation system) |
| `--ink` / 2 / slate | `#1d1d1f` / `#333` / `#5a6470` | Text ramp |
| Reds | `#cc0000` SOS · `#dc2626` errors | Semantic only — never themed |

Decorative blue is banned: card titles, labels, eyebrows are ink/slate. Blue = "you can act here."

## Typography

- **Display (`--font-display`):** Newsreader (Google Fonts, loaded in `frontend/index.html`), **weight 400 only**, tracking −0.02em. All h1/h2 + the tagline. Never bold; emphasis via size or italic (e.g. the italic "two" in the tagline).
- **Body (`--font-body`):** SF Pro Text stack. 18px base (`--text-base`), never below 16px for content; 1.47–1.6 line-height; max measure ~65ch.
- **UI sans (`--font-sans`):** SF Pro Display stack — wordmark, chips, tabular numerals (chapter numbers, counters).
- Scale: 13 / 15 / 18 / 22 / 28 / 34 / 40 px (`--text-xs` … `--text-3xl`); hero serif up to 60px on the landing.

## Components

- **Cards:** white, `1px solid var(--border)`, radius 14–20px, padding ~24px (40px for hero cards). No shadow; hover = warm hairline tint + whisper (`.lift`).
- **Buttons:** one **filled** sky-blue pill primary per screen (44px min height); secondary = outlined hairline pill; tertiary = text button. Never outlined-primary (elder affordance).
- **Inputs:** full visible box on `--surface` fill, `--border` hairline, radius 11px, calm sky focus glow. Never borderless/bottom-border-only.
- **Trust artifacts:** sky-wash chips with `--blue-soft` hairline; "+N" and "trust" words in gold; ladder nodes numbered, goal node holds the turtle mark.
- **Chapter marker (landing signature):** tabular `0N` + 26px hairline + small-caps label, slate/ink — a real sequence, not decorative eyebrows.

## Layout

- 8px spacing scale (`--space-1..16`); 64px between sections ("one idea per screen").
- Content column centers itself, text left-aligned; titles max ~20ch, leads ~54ch.
- Responsive: stacked below 640/900px breakpoints; wide content scrolls in its own container.

## Motion

Emil Kowalski rules (see `.claude/skills/review-animations`): UI motion <300ms, ease-out/custom curves only (no ease-in, no bounce), `transform`/`opacity` only, interruptible, frequency-appropriate, asymmetric enter/exit, `prefers-reduced-motion` honored (near-zero duration, content never hidden). Entrance reveals use the `.bf` blur-fade with stagger.
