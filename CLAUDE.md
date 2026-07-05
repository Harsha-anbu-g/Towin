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

## Common Pitfalls (two-strikes rule: add an entry when the same mistake happens twice)

### Local dev
- Postgres is **native Homebrew** on :5432 — do NOT `docker compose up postgres` (port conflict). Backend on :8080.
- Port 5173 is often held by the user's portfolio site. Run the frontend with `npm run dev -- --port 5174 --strictPort`
  and start the backend with `CORS_ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"`
  (application.yml defaults to 5173 only → other ports fail with 403). Never kill vite servers already running.
- Login request field is **`identifier`** (username/email/phone), not `email`. Repeated bad logins trip a
  **15-minute per-IP 429** — use the demo logins (they bypass the limiter) when testing.
- Demo data self-resets ~5 min after a visitor's last change; don't chase "disappearing" test data.

### CI / deploy
- **Push to `main` = live deploy**: Railway auto-deploys the backend, Vercel the frontend (only when files
  under `frontend/` changed — docs-only commits skip the frontend build).
- Regenerate `frontend/package-lock.json` **on Linux** (docker `node:22-bookworm-slim`) when deps change —
  macOS npm prunes Linux-only optional deps and `npm ci` breaks in `.github/workflows/ci.yml`.
- **Railway blocks all outbound SMTP** — email goes through Brevo's HTTPS API (`EmailService`); never add JavaMail/SMTP.
- `frontend/.env.production` bakes the prod API URL into every Vercel build — **don't delete it**.
  Vercel CLI: pass env values with `--value` (stdin silently stores empty); to bake env vars manually use
  `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
- Admin account is bootstrapped at startup by `AdminSeeder` from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars;
  the Ask-AI assistant stays off until `GROQ_API_KEY` is set. Both live only in Railway variables, never in code.
- The assistant's knowledge base (`resources/assistant/knowledge.md`) is deliberately curated — never bulk-add
  internal notes, audit reports, or plans to it.

### Debugging
- When a UI message "looks wrong", trace the render branch and the data/state driving it **before** rewording copy —
  the bug is usually impossible/stale state (e.g. seed data), not the string.
- Unverified new accounts are hard-gated (no posting/messaging until email verify); demo + pre-existing accounts
  are grandfathered as verified — a "why can't this user post?" bug is usually the verification gate working as designed.

## Established type system (in `src/index.css` tokens)
- Headings + the tagline: **Newsreader** serif at weight **400** (`--font-display`), tracking ~-0.02em.
- Body: **SF Pro** (`--font-body`) for on-screen + elderly legibility.
- Sky-blue (`--blue`) reserved for **actions**; gold `#9C7A3C` for "trust"; green `#1a5c2e` for achieved.
- **Hairline borders over drop shadows**; elevation via surface contrast.
- **Canvas: warm parchment — RESOLVED** (user-approved 2026-07-05 after a live A/B on localhost;
  chose warm over Impeccable's near-neutral stance). Full token spec in `DESIGN.md` at repo root;
  strategy in `PRODUCT.md`. Every impeccable command reads both.
