# ToWin — Frontend Design Workflow

Design tooling is installed for this repo. Apply it on every frontend file you create or edit.

## Skills & tools
- **Impeccable** (`.claude/skills/impeccable`, by Paul Bakaus) — design guidance + anti-slop rules.
  Apply its rules to every frontend edit. Run `/impeccable audit <area>` after major UI changes and
  `/impeccable polish <page>` before shipping. Project context lives in `PRODUCT.md` + `DESIGN.md` at repo root.
- **Emil Kowalski's skills** (`.claude/skills/emil-design-eng`, `.claude/skills/review-animations`) —
  motion craft. Apply to ALL motion / micro-interactions:
  - No `ease-in` for UI motion (ease-out or a strong custom curve).
  - UI animations **under 300ms**.
  - Custom easing curves — no default CSS easings, no bounce/elastic.
  - Animate `transform` / `opacity` only (GPU); never width/height/top/left.
  - Always honor `prefers-reduced-motion` (gentler, not zero).
  - Asymmetric enter/exit; frequency-appropriate (frequent/keyboard actions get little or no motion).
- **21st.dev Magic MCP** — for ANY new UI component, search the Magic MCP for an existing component
  **before** writing one from scratch.
- **Taste** (Jay Feldman / Lead Gen Jay) — final anti-slop quality review pass before shipping any page.
  *(status: pending install decision — see setup notes)*
- Design lenses: **superpowers**, Anthropic **frontend-design**, **ui-ux-pro-max**.
  Reference gallery: **styles.refero.design**.

## Guardrails
- **NEVER push without explicit permission.** Always: build → show on **localhost** → get approval → then push.
- Elderly-first accessibility: body text ≥16px, 44px tap targets, high contrast, **no dark canvas**.
- Brand palette is largely locked; redesigns are typography / layout / structure.

## Established type system (in `src/index.css` tokens)
- Headings + the tagline: **Newsreader** serif at weight **400** (`--font-display`), tracking ~-0.02em.
- Body: **SF Pro** (`--font-body`) for on-screen + elderly legibility.
- Sky-blue (`--blue`) reserved for **actions**; gold `#9C7A3C` for "trust"; green `#1a5c2e` for achieved.
- **Hairline borders over drop shadows**; elevation via surface contrast.
- **Canvas: warm parchment — RESOLVED** (user-approved 2026-07-05 after a live A/B on localhost;
  chose warm over Impeccable's near-neutral stance). Full token spec in `DESIGN.md` at repo root;
  strategy in `PRODUCT.md`. Every impeccable command reads both.
