# ToWin — Design System

> The source of truth for ToWin's look and feel. This describes the **actual**
> implemented design (see [src/index.css](src/index.css)), not an aspiration.
> An earlier version of this file was an analysis of Apple.com; it is preserved
> as `DESIGN.apple-reference.md` for reference only and is **not** our system.

## Brand in one breath

ToWin connects older adults with trusted helpers. The feeling is **calm, warm,
and reassuring** — never busy or clinical. Tagline: **"It takes two To Win."**

- **Mascot / logo:** a turtle (tortoise) — patient, steady, dependable.
- **Palette:** sky-blue + leaf-green, on soft near-white surfaces.
- **Audience-first:** our primary users are elderly. **Accessibility is a
  feature, not a nicety** — large text, calm motion, clear focus, big targets.

## Colors (locked)

> These values are **locked**. Do not introduce new accent colors or alter the
> existing hexes/gradients/shadows. Design changes happen in typography, layout,
> spacing, and structure — not color. Tokens live in `:root` in `src/index.css`.

### Brand & accent
| Token | Value | Use |
|---|---|---|
| `--blue` | `#4FA3CE` | Primary sky-blue. Every interactive element: links, primary buttons, focus ring. |
| `--blue-dark` | `#004499` | Pressed/hover depth, shimmer gradient endpoints. |
| `--blue-focus` | `#0071e3` | Brighter blue reserved for focus accents. |
| `--green` | `#3D8AB0` | Secondary accent. ⚠️ Named "green" but the value is teal — see Known Gaps. |

### Trust — special rule
**Any UI text containing the word "trust" uses `#9C7A3C`** (a luxury golden-brown).
This is a deliberate brand signal for the Trust Journey / trust score. Never
substitute the blue for trust labels.

### Text (ink)
`--ink #1d1d1f` (headlines & body) · `--ink-2 #333333` · `--ink-3 #7a7a7a`
(secondary) · `--ink-4 #a0a0a5` (muted / placeholder).

### Surfaces & borders
`--canvas #ffffff` · `--surface #f5f5f7` · `--surface-pearl #fafafc` ·
`--border #e0e0e0` · `--border-soft #f0f0f0`.

### Semantic
`--red #cc0000` (errors/destructive) · `--amber #b05000` (warnings).

### Gradients & depth — yes, we use them
Unlike a flat Apple-style system, ToWin's calm/zen feel **does** use soft
gradients and gentle shadows:
- Auth pages: layered radial gradients in sky-blue and leaf-green washes.
- `AuroraBackground`: slow drifting blobs behind hero moments.
- `.shimmer-btn`: animated sky-blue gradient on the primary CTA.
- `.lift`: a soft shadow lift on card hover.
All motion must respect "reduce motion" (see Accessibility).

## Typography

- **Display:** `-apple-system, 'SF Pro Display', system-ui, sans-serif` (`--font-display`).
- **Body / UI:** `-apple-system, 'SF Pro Text', system-ui, sans-serif` (`--font-body`).
- **Base body size: 18px** / line-height 1.47 / letter-spacing -0.374px. We run
  larger than the typical 16px because our readers are older — **never set body
  text below 16px**, and prefer 16–18px for anything users must read.
- Headlines use weight 600–700 with slightly negative tracking.

### Readable-size guidance (elderly-first)
| Role | Minimum |
|---|---|
| Body / paragraphs | 16–18px |
| Field labels, helper text | 14–15px |
| Buttons | 15–16px |
| Badges / status pills | 12–13px (only for short, non-essential labels) |

## Shape & spacing

Use the token scales in `:root` (avoid hardcoding px):
- **Radius:** `--radius-md` 11px (inputs) · `--radius-lg` 14px · `--radius-xl` 18px ·
  `--radius-2xl` 20px (cards) · `--radius-pill` 9999px. Avoid in-between values.
- **Spacing:** `--space-1`…`--space-12` on an 8px base. Loose and breathable.
- **Type:** `--text-xs`…`--text-3xl`; `--text-base` is 18px (body). Never < 16px.

## Components (implemented)

Buttons (in `src/index.css`):
- `.btn-primary` / `.primary-btn` — sky-blue pills (primary action).
- `.shimmer-btn` — animated primary CTA for hero moments.
- `.ghost-btn` — bordered secondary.

Surfaces & inputs:
- `.card` — white, `--radius-2xl`, hairline border.
- `.field` — 17px text, soft surface fill, blue focus glow.
- `.pill` — small uppercase status chips.

## Accessibility (first-class)

- **Reduce motion:** a global `@media (prefers-reduced-motion: reduce)` rule
  near-zeros all animation/transition durations. Honor it — never force motion.
- **Keyboard focus:** a global `:focus-visible` outline (2px `--blue`) shows for
  keyboard users only. Don't remove outlines without providing a visible
  alternative.
- **Text size:** 18px base; don't go below 16px for body. See guidance above.
- **Touch targets:** aim for ≥44px (ideally 48px) tappable height for elderly
  users. Several small pill buttons are still below this — see Known Gaps.
- **Alt text:** all meaningful images carry `alt`.

## Do / Don't

**Do**
- Use `--blue` for every "click me" signal; `--trust-gold` for trust text.
- Keep copy in plain, everyday words (see brand voice). Tagline is exactly
  "It takes two To Win."
- Prefer larger text and generous spacing — our users thank you for it.

**Don't**
- Don't add new accent colors or change locked hexes/gradients/shadows.
- Don't set body text below 16px.
- Don't ship continuous motion without a reduced-motion fallback.

## Known gaps (tracked)

- **Token migration is partial:** `color`/`background`/`borderColor` literals now
  use `var(--token)`, but values inside ternaries, template strings, and SVG
  `fill`/`stroke` remain raw hex (SVG attributes can't take `var()`). Finishing
  these needs per-case work, not a sweep.
- **Touch targets:** some 36–40px pill buttons are below the 44px minimum
  (deferred — layout-sensitive).
- **Type-scale adoption:** inline `fontSize` values don't all map onto the
  `--text-*` scale yet; new code should use the tokens.
- **Hero photos** could still gain responsive `srcset`/WebP; the heavy assets are
  already optimized (logos 55KB, heroes JPEG ~200–310KB).

**Resolved since the audit:** dead files & dead `apple-*` CSS removed; misnamed/
unused `--green` removed; favicon 915KB→4KB; unused Google Fonts dropped;
reduced-motion + keyboard-focus added; social/SEO meta added; full palette +
radius/spacing/type token scales formalized and base components wired.
