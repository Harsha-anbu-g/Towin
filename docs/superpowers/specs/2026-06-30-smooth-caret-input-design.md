# Smooth-Caret Input (`SmoothInput`) — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design), pending implementation plan
**Author:** ToWin team

## Summary

Add a "smooth typing" micro-interaction: as the user types in a single-line
text field, the text caret **springs smoothly** to its new position instead of
jumping. The text itself does not move — only the caret animates.

This is adapted from the Skiper UI `Skiper106` showcase component (TSX, Next.js,
`dialkit`, shadcn). We rebuild it as a plain-JSX, Vite-friendly, **drop-in
replacement** for `<input>` that integrates with ToWin's existing `.field`
styling and brand tokens — no showcase chrome, no dev-only dependencies.

Rollout is **app-wide** via a single reusable component, with a safe native
fallback so swapping any input is risk-free.

## Goals

- One reusable `SmoothInput` component that is a true drop-in for `<input>`.
- Springy caret on single-line text-like fields, brand-consistent and calm.
- Zero layout or behavior regression on existing forms.
- Accessible: respects `prefers-reduced-motion`; safe for the elderly audience.

## Non-Goals

- Textareas (multi-line). The effect is single-line horizontal only; the 8
  existing `<textarea>`s stay native.
- Non-text inputs (number, date, file, checkbox, range). They render natively.
- Adding a test framework (none is installed). Verification is browser-based.
- Any change to colors, gradients, shadows, or copy. Palette stays locked.

## Context (current codebase)

- React 19 + Vite, plain JSX. `framer-motion@12.38` already installed.
- Inputs are styled two ways and **both must keep working**:
  - shared `.field` class (26 usages): white `--surface`, `--border`, 17px,
    `--ink` text, blue focus ring.
  - inline `style={...}` objects (e.g. `Feedback.jsx` uses `inputStyle`).
- Password fields wrap the input in a `position:relative` div with an
  absolutely-positioned eye toggle and `paddingRight: 44px` on the input.
- Brand token: `--blue: #4FA3CE` (primary action; also the `.field:focus`
  border color). This is the caret color — no new color is introduced.
- The 28 `type="button"` / 14 `type="submit"` are `<button>` elements, **not**
  inputs, and are out of scope.

## Component design — `frontend/src/components/SmoothInput.jsx`

### API

A drop-in for `<input>`. Forwards **every** prop to the underlying input:
`value` / `defaultValue`, `onChange`, `onBlur`, `type`, `required`,
`autoComplete`, `placeholder`, `className`, `style`, and `ref` (via
`forwardRef`, merged with the internal input ref). Controlled and uncontrolled
both supported (logic carried over from the source). Default `type="text"`.

Optional prop: `caretColor` (default `var(--blue)`) for future overrides.

### Two render branches

1. **Smooth branch** — when `type` ∈
   `{ text, password, tel, url, search }` **and** motion is allowed
   (`useReducedMotion()` is false): renders the native input plus a springy
   caret overlay.
2. **Native passthrough** — for any other `type` (email, number, date, file,
   checkbox, range…) **or** when `prefers-reduced-motion` is set: renders a
   plain `<input {...props} ref={ref} />` with no wrapper and no overlay. This
   is identical to today's markup, which is what makes app-wide swapping safe.

> **Implementation note — `email` excluded.** `email`, `number`, and `date`
> inputs return `null` for `selectionStart`/`selectionEnd` (no text-selection
> API per the HTML spec), so the caret index can't be tracked and the overlay
> would stick at position 0. `email` therefore falls into the native branch.
> `text`, `password`, `tel`, `url`, and `search` all support selection.

The password show/hide toggle flips `type` between `password` and `text` — both
smooth-eligible — so the branch never changes mid-session and the input never
remounts.

### Layout transparency (critical)

The source's showcase wrapper (`bg-muted2 rounded-2xl p-4`, grid container) is
**dropped**. The smooth branch uses a minimal, layout-neutral wrapper:

```
<span style={{ position: 'relative', display: 'block', width: '100%' }}>
  <input ref={inputRef} {...props}
         style={{ ...props.style, caretColor: 'transparent' }} />
  <span ref={measureRef} aria-hidden
        style={{ position:'absolute', visibility:'hidden',
                 whiteSpace:'pre', top:0, left:0 }} />
  <motion.span                         // the caret
        style={{ position:'absolute', top:0, bottom:0, margin:'auto 0',
                 width:2, height: caretHeight /* px, from computed font-size */,
                 borderRadius:1, background:'var(--blue)', pointerEvents:'none',
                 x: springCaretX, opacity: caretOpacity }} />
</span>
```

Why this is transparent:
- `.field` is already `display:block; width:100%; box-sizing:border-box`, so a
  `display:block; width:100%` wrapper occupies the same box. The input keeps its
  own `className`/`style` (including error `borderColor` and `paddingRight`).
- For password fields, the outer `position:relative` div and its absolute eye
  button are unchanged; the eye stays positioned against the outer div, and the
  caret measuring reads the input's computed `paddingRight`, so the caret never
  slides under the eye icon.
- Inline-styled inputs (e.g. `Feedback`) work because `style` is forwarded.

### Caret geometry (carried over from source)

- A hidden measuring `<span>` is synced to the input's computed font + letter
  spacing, given the text before the caret (password chars for masked fields),
  and its `offsetWidth + paddingLeft` gives the caret's absolute x.
- Caret **height** is derived in JS from the input's computed `font-size`
  (≈1.1×), not a CSS `em` — the caret span is a sibling of the input and does
  not inherit the input's font-size, so an `em` value would mis-size it.
- `scrollCaretIntoView` keeps the caret visible when text overflows; the caret
  hides (`opacity 0`) when it scrolls out of view, on blur, and when a range is
  selected.
- `selectionchange`, `scroll`, font-load, and `ResizeObserver` listeners update
  the caret while focused; all are attached on mount and cleaned up on unmount.
  Work only happens while the input is the active element.

### Motion & accessibility

- Spring hardcoded: `{ stiffness: 500, damping: 30, mass: 0.5 }`. `dialkit`
  removed entirely.
- `prefers-reduced-motion` → native passthrough (no overlay, native caret) —
  fully calm, which suits the elderly/calm product ethos.
- `navigator.userAgent` access (for the password bullet char) is guarded for
  safety though Vite is client-only.

## Rollout

Replace text-like `<input>` with `<SmoothInput>` (same props) across the 14
files that contain inputs:

Login, Register, ForgotPassword, ResetPassword, ChangePassword, ProfileEdit,
FinishSetup, Feedback, EmergencyContacts, Admin, ElderDashboard,
HelperDashboard, MessagesInbox, LocationPrompt.

Leave untouched: all `<textarea>`, and `number` / `date` / `file` / `checkbox`
inputs (they may also be swapped to `SmoothInput` harmlessly, but the default is
to leave them as-is to minimize churn).

## Verification (browser-based, no unit-test framework)

Run the Vite dev server and use Playwright to confirm:

1. **Caret tracking** — type into a text field (e.g. Login username); the caret
   bar appears and springs to follow input.
2. **Password** — text stays masked; caret behaves over bullet characters; eye
   toggle still shows/hides without layout shift.
3. **Fallback** — a `type="number"` field (Admin) renders a native caret/no
   overlay; with `prefers-reduced-motion` emulated, all fields render native.
4. **No regressions** — each touched page renders with fields visually
   unchanged (screenshot spot-check of Login, Register, ProfileEdit, Feedback).
5. **Selection/blur** — caret hides on blur and when selecting a range.

## Risks & mitigations

- **Layout regression across many files** → native-identical passthrough plus
  full prop/style forwarding; per-page screenshot verification.
- **Caret misalignment with custom padding** → geometry reads computed padding;
  verified on the password (44px right pad) case.
- **Performance app-wide** → listeners are per-mounted-input and only compute
  while focused; negligible.
```
