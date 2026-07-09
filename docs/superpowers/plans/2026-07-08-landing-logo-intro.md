# Landing logo intro — self-drawing tortoise mark

## Context

The tortoise mark should draw itself once when a visitor opens the landing page, then settle.
No video, no export — an in-app SVG animation, following the 3-second sequence the user specified.

The blocker: **there is no vector source for the logo anywhere in the repo.**
`assets/logos/final logo.PNG` (1254×1254) is the canonical artwork; `frontend/public/logo.png`
is a 256px downscale of it; `frontend/public/favicon.svg` is a base64 PNG wrapped in an
`<image>` tag, not paths. `TurtleLogo.jsx` just serves the raster.

A stroke-draw reveal (`stroke-dashoffset`) needs **centerline** paths. Auto-tracing a raster
produces the *outline* of each stroke — a contour running up one side of the line and back down
the other — so the reveal would crawl around both edges instead of down the spine. It looks
broken and can't be fixed downstream. So the geometry has to be derived, and derived accurately.

The mark is the ground truth. Nothing gets redrawn from imagination; the vector is fitted to the
PNG and verified against it numerically before a single frame of motion is written.

## Stage 1 — Derive the geometry, prove it matches

Work in the scratchpad, nothing committed yet.

1. Threshold `assets/logos/final logo.PNG` to a binary mask with ImageMagick (installed).
2. Author centerline paths in a `0 0 1254 1254` viewBox. The mark is bilaterally symmetric —
   build the **left half only**, mirror with `transform="scale(-1,1)"`. Halves the work and
   guarantees the logo stays symmetric, which a per-side trace would not.
3. Measured constants to recover from the mask: stroke width, shell bounding box, heart notch
   depth, heart apex, head capsule width/height, leg loop centers + angles, the 7-cell seam
   vertices.
4. Render the candidate through headless Chromium (Playwright MCP — same renderer that ships it),
   screenshot at 1254², and diff against the mask: `magick compare -metric RMSE`.
   Iterate until the residual is confined to antialiasing on the round caps.
5. **Gate:** show the overlay + diff image. Nothing proceeds until the user approves the trace.

Stroke color sampled from the artwork is `#025E32` — *not* `--green-deep` (`#1a5c2e`).
Tokenize as `--logo-green: #025E32`. This documents the existing color; it does not change it.

Paths must come out as separately addressable nodes, since the sequence animates them
independently:

- `#shell` — one closed heart path, starting **and** ending at top center (the spec's requirement)
- `#head` — capsule arch
- `#leg-tl` `#leg-tr` `#leg-bl` `#leg-br` — teardrop loops (they cross the shell outline; drawn over it)
- `#cell-c` + `#cell-n` `#cell-ne` `#cell-se` `#cell-s` `#cell-sw` `#cell-nw` — seven closed cells

Cells are authored as **complete stroked polygons, not shared seams.** Adjacent cells double-draw
their common edge, but at identical color with round joins that is invisible — and it's what makes
each cell scale from its own centroid (`transform-box: fill-box; transform-origin: center`)
instead of tearing the seam grid apart. This is the whole reason the "pop in one by one" beat works.

## Stage 2 — `TortoiseMark.jsx` + `LogoIntro.jsx`

**`frontend/src/components/TortoiseMark.jsx`** (new) — the traced SVG. Single source of geometry.
Takes `animated` (bool). Static by default, so it can later replace the PNG elsewhere if wanted.

**`frontend/src/components/LogoIntro.jsx`** (new) — the overlay and its orchestration.

Timing, as specified, with easing assigned per beat:

| t (s) | Beat | Technique | Easing |
|---|---|---|---|
| 0.0 – 1.2 | Shell draws, top center → back to top center | `stroke-dashoffset` → 0 | `--ease-in-out` |
| 1.2 – 1.5 | Head extends upward, same pen | `stroke-dashoffset` → 0 | `--ease-in-out` |
| 1.5 – 2.0 | Legs: top pair @1.50, bottom pair @1.65, 300ms each | `stroke-dashoffset` → 0 | `--ease-out` |
| 2.0 – 2.6 | 7 cells, center then clockwise, 70ms stagger, 200ms each | `scale(0.9→1)` + `opacity` | `--ease-out` |
| 2.6 – 3.0 | "ToWin" fades in below | `opacity` + `translateY(6px→0)` | `--ease-out` |
| 3.0 – 3.4 | Hold, then overlay fades out | `opacity` | `--ease-out` |

**On the easing — I'm walking back what I said earlier.** I told you `ease-in-out` was wrong here.
It isn't, for the two draw beats. [STANDARDS.md](.claude/skills/review-animations/STANDARDS.md#L18-L37)
bans slow starts because they delay the response to *something the user just did*. Nobody clicked
this; it's a brand intro, which that same file files under "rare / first-time → can add delight."
A pen accelerating and decelerating over 1.2s is exactly the deliberate feel you asked for. Your
instinct was right. What I do change is the *curve*: the built-in `ease-in-out` is too weak, so use
the strong tokens already in the standards — `cubic-bezier(0.77, 0, 0.175, 1)` for the draws,
`cubic-bezier(0.23, 1, 0.32, 1)` for things that arrive (legs, cells, wordmark).

Two more things the standards already settle, both of which the spec got right independently:
`scale(0.9→1)` on the cells rather than `scale(0)` (nothing appears from nothing), and the 70ms
cell stagger lands inside the 30–80ms window.

Honest note on performance: `stroke-dashoffset` is not `transform`/`opacity`. It skips layout but
does repaint. On a one-time intro over an otherwise empty overlay that is fine, and the alternative
(clip-path sweeps per path) is worse. Everything after the draw beats is transform/opacity only.

Wordmark: SF Pro Display 600, `letter-spacing: -0.374px` — copied exactly from the existing lockup
in [Landing.jsx:429-431](frontend/src/pages/Landing.jsx#L429-L431). Your prompt said "clean modern
sans serif" and that turns out to be what the brand already uses; `--font-display` (Newsreader) is
for headings, not the wordmark. No conflict.

## Stage 3 — Mount on Landing

Edit [Landing.jsx](frontend/src/pages/Landing.jsx) — render `<LogoIntro />` above the canvas.
Both the mobile and laptop return branches, one line each.

Behavior:

- **Once per session.** `sessionStorage['towin:intro-seen']`. Set it before the animation starts,
  not after, so a mid-intro reload doesn't replay. (One-line swap to `localStorage` if you'd rather
  it play once per visitor ever — say the word.)
- **Skip on any input.** Click, keypress, scroll, or touch cancels to a 150ms fade. A 3s gate in
  front of an elderly user who wants to read the page is the one way this feature goes wrong.
- **Reduced motion: don't mount it at all.** Not "animate faster" — the visitor lands directly on
  the deck. `index.css:1076` has a global `animation-duration: 0.01ms !important` killswitch, which
  would otherwise flash all five beats in a single frame. Checking the media query in JS and
  skipping the mount avoids that.
- **Canvas is `var(--surface)`, not white.** Your prompt said white; the landing is warm parchment.
  White would flash, then shift. In dark mode, put the `--tortoise-bed` disc behind the mark, the
  same treatment `.tortoise-lit` (`index.css:449`) already gives the PNG — the stroke stays `#025E32`.

## Files

| File | Change |
|---|---|
| `frontend/src/components/TortoiseMark.jsx` | new — traced SVG geometry |
| `frontend/src/components/LogoIntro.jsx` | new — overlay, timing, skip, session gate |
| `frontend/src/index.css` | new — `--logo-green`, keyframes, easing tokens if absent |
| `frontend/src/pages/Landing.jsx` | edit — mount `<LogoIntro />` in both branches |
| scratchpad | tracing harness + diff images, not committed |

## Verification

1. **Trace fidelity** — `magick compare -metric RMSE` candidate vs. mask; show the user the overlay.
   This is the gate for Stage 1; no motion work happens before it passes.
2. **Each beat** — Playwright on `localhost:5174`, pause with
   `document.getAnimations().forEach(a => a.currentTime = T)`, screenshot at
   T = 600 / 1350 / 1750 / 2300 / 2900ms. Confirm the shell is mid-draw, head extending, legs
   arriving, cells popping center-out, wordmark up.
3. **Reduced motion** — emulate `prefers-reduced-motion: reduce`; assert the overlay never mounts.
4. **Session gate** — load, reload in the same tab, assert intro plays exactly once.
5. **Skip** — click at t≈800ms, assert the overlay is gone within 200ms.
6. **Regression** — `npm run build`, existing frontend tests, and confirm the scroll deck and
   tortoise trail still scrub correctly with the intro in front of them.

Shown on localhost for review before any commit. No push without approval.

## Out of scope

- Replacing the PNG mark elsewhere in the app (topbar, favicon, trail). The traced SVG makes that
  possible later; this change doesn't touch them.
- Handing the drawn logo off into the topbar mark (a nice beat, but scope creep — flag it after).
- Any video export.

---

# Implementation notes (as built, 2026-07-08)

## How the geometry was recovered

There is no vector source. `frontend/src/components/tortoiseMarkPaths.js` is generated,
not hand-drawn. The pipeline, run against `assets/logos/final logo.PNG` (1254x1254):

1. Threshold to a binary mask at 60%.
2. Zhang-Suen thinning to a 1px skeleton (21 rounds, 5325 px, **0 endpoints** — the mark
   is all closed loops, so the skeleton has no spurs).
3. Classify skeleton pixels by **crossing number**, not 8-neighbour count: in a thinned
   skeleton a diagonal staircase pixel has 3 neighbours but is a plain path pixel.
   Result: 22 branch points, which cluster to 20 nodes.
4. Cut at the junctions *and their 8-neighbourhood* (removing one pixel does not
   disconnect an 8-connected skeleton) -> 31 branches, each joining two nodes.
5. Fit each branch with centripetal Catmull-Rom -> cubic Bezier, resampled at 21px.

## Measured constants

| Quantity | Value | How |
| --- | --- | --- |
| symmetry axis | `x = 625.0` | minimum of mirror-mismatch sweep (2.29%, all antialiasing) |
| stroke width | `27 px` | vertical ink runs across the *horizontal* seam (slanted strokes read 28-29) |
| stroke colour | `#025E32` | histogram of the artwork. **Not** `--green-deep` (#1a5c2e) |
| shell interior | centre hexagon + 6 cells | hexagon on nodes n8,n9,n12,n15,n14,n11, centred (625.5, 694.5) |

Left half is truth; the right half is its mirror, so the mark is exactly symmetric.

## The two corners thinning destroys

Zhang-Suen retracts sharp corners, so the skeleton is useless at the heart's cleft and
its bottom point. Both were recovered from the ink instead: for a locally straight stroke
the **midpoint of a vertical ink run lies exactly on the centreline**. Fitting a quadratic
to those midpoints (max residual 0.44px / 0.48px) and extrapolating the two arms:

- cleft apex `(625, 470.96)`, arms at 39.9 deg
- tip apex `(625, 1035.64)`, arms at 30.6 deg

The cleft is **mitred, not round**: a round join reaches only y=484.5, but the artwork's ink
reaches 488, and miter predicts 488.6. Hence `stroke-linejoin: miter` on `#shell` alone
(miterlimit needed: 1.30). Everything else stays round — at a hexagon vertex three 27px
strokes already cover the disc a round join would draw.

## Verified fidelity

Rendered in headless Chrome at 1254x1254 and diffed against the artwork mask:

- ink agreement 133,291 / 137,563 px
- mean edge error **0.91 px**; p99 3.8 px; worst 5.0 px
- at a 160px on-screen render: mean 0.11 px, worst 0.64 px

`STEP=21, PREC=1` was chosen over `STEP=11`: 15.5KB of path data instead of 29KB, for
45 extra disagreeing pixels out of 137,563.

## Behaviour (differs from the plan above)

**The intro is NOT skippable** — user's call, 2026-07-08. No click, key, scroll, wheel or
touch cancels it. Verified by dispatching all of them at 700ms and asserting the overlay
survives. The one exception is `prefers-reduced-motion`, which never mounts the component
(and does not consume the once-per-session flag).
