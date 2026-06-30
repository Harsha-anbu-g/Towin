# SmoothInput (smooth-caret typing) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `SmoothInput` drop-in that springs the text caret smoothly as you type, and roll it out across all single-line text inputs in the app.

**Architecture:** One JSX component (`frontend/src/components/SmoothInput.jsx`) forwards every `<input>` prop. For text-like types with motion allowed it renders the native input (its native caret hidden) plus a framer-motion caret overlay positioned by measuring text width in a hidden span. For any other type, or `prefers-reduced-motion`, it returns a plain native `<input>` — identical to today's markup, so swapping is risk-free. Roll out by replacing text-like `<input>` with `<SmoothInput>` in 13 files.

**Tech Stack:** React 19, Vite, framer-motion 12 (already installed), plain CSS tokens (`var(--blue)`).

**Spec:** `docs/superpowers/specs/2026-06-30-smooth-caret-input-design.md`

**Note on testing:** The repo has no JS test framework installed, and this is a visual/DOM-geometry effect. Per the approved spec, verification is browser-based using the **superpowers:webapp-testing** skill (Playwright) against the Vite dev server — not unit tests. "Verify" steps below mean: drive the running app and observe.

**Note on commits:** This repo's workflow commits directly to `main` (see project memory). Each task ends with a commit. No `Co-Authored-By` / generated-by footers.

---

## File Structure

- **Create:** `frontend/src/components/SmoothInput.jsx` — the component. Single responsibility: render an input with an optional smooth-caret overlay; transparent prop/style/ref forwarding; native fallback.
- **Modify (add import + swap text-like `<input>` → `<SmoothInput>`):**
  `pages/Login.jsx`, `pages/Register.jsx`, `pages/ForgotPassword.jsx`, `pages/ResetPassword.jsx`, `pages/ChangePassword.jsx`, `pages/FinishSetup.jsx`, `pages/ProfileEdit.jsx`, `pages/Feedback.jsx`, `pages/EmergencyContacts.jsx`, `pages/Admin.jsx`, `pages/ElderDashboard.jsx`, `pages/MessagesInbox.jsx`, `components/LocationPrompt.jsx`.
- **Not touched:** all `<textarea>`; `HelperDashboard.jsx` (only a checkbox); and `number`/`date`/`file`/`checkbox` inputs inside the files above.

### Swap inventory (text-like inputs only)

Line numbers are pre-edit references; after adding the import they shift by a few lines — match by the input, not the number. **Swap these:**

| File | Inputs to swap (type) | Skip (leave `<input>`) |
|---|---|---|
| `pages/Login.jsx` | 356 text, 375 password-toggle | — |
| `pages/Register.jsx` | 563 text, 585 email, 608 pwd-toggle, 649 pwd-toggle | 672 checkbox |
| `pages/ForgotPassword.jsx` | 62 email | — |
| `pages/ResetPassword.jsx` | 72 password, 79 password | — |
| `pages/ChangePassword.jsx` | 82, 88, 94 (all password) | — |
| `pages/FinishSetup.jsx` | 181 text, 204 tel | — |
| `pages/ProfileEdit.jsx` | 374, 423, 430, 446, 450, 454, 458, 470, 483, 487, 495, 577¹, 679, 683, 689 (text) | 303 file, 397 number, 466 date, 606 file, 693 number |
| `pages/Feedback.jsx` | 170 text, 175 email, 180 tel | — |
| `pages/EmergencyContacts.jsx` | 363, 369, 377 (text) | 383 number |
| `pages/Admin.jsx` | 390 text | — |
| `pages/ElderDashboard.jsx` | 1040 text, 1067 text | 995 checkbox |
| `pages/MessagesInbox.jsx` | 170 text | — |
| `components/LocationPrompt.jsx` | 41¹ text | — |

¹ **Flex-row field** — relies on `flex:1` to grow; use `wrapperStyle={{ flex: 1 }}` (see Task 5, Step 2a).

The swap is mechanical: change the tag name `<input` → `<SmoothInput` (and its self-closing `/>` stays). All attributes (`className`, `style`, `value`, `onChange`, `{...f('x')}` spreads, `required`, `placeholder`, `autoComplete`, `paddingRight`, error `borderColor`) are forwarded unchanged.

---

## Chunk 1: Component + auth pages

### Task 1: Create the SmoothInput component

**Files:**
- Create: `frontend/src/components/SmoothInput.jsx`

- [ ] **Step 1: Write the component**

```jsx
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

// Types where a single-line horizontal caret makes sense.
const SMOOTH_TYPES = new Set(['text', 'password', 'email', 'tel', 'url', 'search']);
const SPRING = { stiffness: 500, damping: 30, mass: 0.5 };

// Firefox masks passwords with a slightly different bullet glyph.
const PASSWORD_CHAR =
  typeof navigator !== 'undefined' && /firefox|fxios/i.test(navigator.userAgent)
    ? '●'
    : '•';

const SmoothInput = forwardRef(function SmoothInput(
  {
    type = 'text',
    className,
    style,
    wrapperStyle, // for inputs that are flex/grid children (e.g. flex:1 in a row)
    value,
    defaultValue,
    onChange,
    onBlur,
    caretColor = 'var(--blue)',
    ...props
  },
  forwardedRef,
) {
  const prefersReducedMotion = useReducedMotion();
  const smooth = SMOOTH_TYPES.has(type) && !prefersReducedMotion;

  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [caretHeight, setCaretHeight] = useState(18);

  const caretX = useMotionValue(0);
  const caretOpacity = useMotionValue(0);
  const springCaretX = useSpring(caretX, SPRING);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const measureRef = useRef(null);

  const isControlled = value !== undefined;
  const inputValue = isControlled ? value : internalValue;

  const setRefs = useCallback(
    (node) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  // Mirror the input's font onto the hidden measuring span.
  const syncMeasureSpan = () => {
    const input = inputRef.current;
    const span = measureRef.current;
    if (!input || !span) return;
    const s = window.getComputedStyle(input);
    span.style.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    span.style.letterSpacing = s.letterSpacing;
    span.style.fontFeatureSettings = s.fontFeatureSettings;
    span.style.fontVariationSettings = s.fontVariationSettings;
  };

  // Absolute x (within the input box) of the caret for the given prefix text.
  const measurePrefixWidth = (text) => {
    const input = inputRef.current;
    const span = measureRef.current;
    if (!input || !span) return null;
    syncMeasureSpan();
    span.textContent = text;
    const paddingLeft = parseFloat(window.getComputedStyle(input).paddingLeft) || 0;
    return text.length > 0 ? span.offsetWidth + paddingLeft : paddingLeft - 1;
  };

  const scrollCaretIntoView = (target, absoluteWidth) => {
    const s = window.getComputedStyle(target);
    const paddingLeft = parseFloat(s.paddingLeft) || 0;
    const paddingRight = parseFloat(s.paddingRight) || 0;
    const maxScroll = Math.max(0, target.scrollWidth - target.clientWidth);
    const visibleRight = target.scrollLeft + target.clientWidth - paddingRight;
    const visibleLeft = target.scrollLeft + paddingLeft;
    if (absoluteWidth > visibleRight) {
      target.scrollLeft = Math.min(absoluteWidth - target.clientWidth + paddingRight, maxScroll);
      return;
    }
    if (absoluteWidth < visibleLeft) {
      target.scrollLeft = Math.max(0, absoluteWidth - paddingLeft);
    }
  };

  const getCaretIndex = (target) => {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    if (start === end) return start;
    return target.selectionDirection === 'backward' ? start : end;
  };

  const updateCaretFromInput = (target) => {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const hasSelection = start !== end;
    const caretIndex = getCaretIndex(target);
    const isPassword = target.type === 'password';
    const textBeforeCaret = isPassword
      ? PASSWORD_CHAR.repeat(caretIndex)
      : target.value.slice(0, caretIndex);

    const absoluteWidth = measurePrefixWidth(textBeforeCaret);
    if (absoluteWidth === null) return;

    scrollCaretIntoView(target, absoluteWidth);

    const s = window.getComputedStyle(target);
    const paddingLeft = parseFloat(s.paddingLeft) || 0;
    const paddingRight = parseFloat(s.paddingRight) || 0;
    const fontSize = parseFloat(s.fontSize) || 16;
    setCaretHeight(Math.round(fontSize * 1.1)); // sibling span doesn't inherit input font-size

    const caretPosition = absoluteWidth - target.scrollLeft;
    const minX = paddingLeft - 1;
    const maxX = target.clientWidth - paddingRight;
    const isVisible = caretPosition >= minX && caretPosition <= maxX + 1;

    caretX.set(Math.min(caretPosition, maxX));
    caretOpacity.set(!isVisible || hasSelection ? 0 : 1);
  };

  const updateCaretRef = useRef(updateCaretFromInput);
  updateCaretRef.current = updateCaretFromInput;

  // Re-measure when the value / type changes while focused.
  useEffect(() => {
    if (!smooth) return;
    const input = inputRef.current;
    if (input && document.activeElement === input) updateCaretRef.current(input);
  }, [inputValue, type, smooth]);

  // Listeners: selection, scroll, font-load, resize.
  useEffect(() => {
    if (!smooth) return;
    const input = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return;

    const updateIfFocused = () => {
      if (document.activeElement === input) updateCaretRef.current(input);
    };
    const handleSelectionChange = () => {
      if (document.activeElement !== input) return;
      requestAnimationFrame(() => {
        if (document.activeElement === input) updateCaretRef.current(input);
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.fonts?.addEventListener('loadingdone', updateIfFocused);
    void document.fonts?.ready.then(updateIfFocused);
    input.addEventListener('scroll', updateIfFocused);

    const resizeObserver = new ResizeObserver(updateIfFocused);
    resizeObserver.observe(container);
    updateIfFocused();

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.fonts?.removeEventListener('loadingdone', updateIfFocused);
      input.removeEventListener('scroll', updateIfFocused);
      resizeObserver.disconnect();
    };
  }, [smooth]);

  const handleChange = (e) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
    if (smooth) requestAnimationFrame(() => updateCaretRef.current(e.target));
  };

  // Native passthrough — identical markup to a plain <input>.
  if (!smooth) {
    return (
      <input
        {...props}
        ref={setRefs}
        type={type}
        className={className}
        style={style}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onBlur={onBlur}
      />
    );
  }

  return (
    <span
      ref={containerRef}
      style={{ position: 'relative', display: 'block', width: '100%', ...wrapperStyle }}
    >
      <input
        {...props}
        ref={setRefs}
        type={type}
        className={className}
        style={{ ...style, caretColor: 'transparent' }}
        value={inputValue}
        onChange={handleChange}
        onBlur={(e) => {
          caretOpacity.set(0);
          onBlur?.(e);
        }}
      />
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
      <motion.span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          margin: 'auto 0',
          width: 2,
          height: caretHeight,
          borderRadius: 1,
          background: caretColor,
          pointerEvents: 'none',
          x: springCaretX,
          opacity: caretOpacity,
        }}
      />
    </span>
  );
});

export default SmoothInput;
```

- [ ] **Step 2: Lint the new file**

Run: `cd frontend && npx eslint src/components/SmoothInput.jsx`
Expected: no errors (warnings about react-refresh are fine).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SmoothInput.jsx
git commit -m "feat(web): add SmoothInput drop-in with springy caret + native fallback"
```

---

### Task 2: Wire Login + start the verification harness

**Files:**
- Modify: `frontend/src/pages/Login.jsx` (import; swap inputs at ~356, ~375)

- [ ] **Step 1: Add the import** near the other imports at the top of `Login.jsx`:

```jsx
import SmoothInput from '../components/SmoothInput';
```

- [ ] **Step 2: Swap the two text-like inputs** — change `<input` → `<SmoothInput` for the identifier field (type="text", className="field") and the password field (type={showPwd ? 'text' : 'password'}, className="field", paddingRight:44px). Leave everything else identical.

- [ ] **Step 3: Start the dev server** (background) and verify with the **superpowers:webapp-testing** skill (Playwright MCP):

Run: `cd frontend && npm run dev` (serves http://localhost:5173)

- [ ] **Step 4: Verify in browser** — navigate to `http://localhost:5173/login`. Confirm:
  - The username and password fields look visually unchanged (same border, padding, focus ring).
  - Typing in the username field shows a thin blue caret that springs to follow the text; the text itself doesn't move.
  - In the password field, characters mask to bullets, the caret tracks over them, and the eye toggle still shows/hides the password with no layout shift; the caret never slides under the eye icon.
  - Selecting a range hides the caret; blurring hides it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Login.jsx
git commit -m "feat(web): use SmoothInput on the Login fields"
```

---

### Task 3: Wire Register

**Files:**
- Modify: `frontend/src/pages/Register.jsx` (import; swap 563 text, 585 email, 608 + 649 password-toggles; skip 672 checkbox)

- [ ] **Step 1:** Add `import SmoothInput from '../components/SmoothInput';`.
- [ ] **Step 2:** Swap the four text-like inputs to `<SmoothInput`. Leave the checkbox as `<input>`.
- [ ] **Step 3: Verify** — navigate to `/register`, type in each field, confirm caret tracks and the agree-to-terms checkbox is unchanged.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Register.jsx
git commit -m "feat(web): use SmoothInput on the Register fields"
```

---

### Task 4: Wire the remaining auth/password pages

**Files:**
- Modify: `pages/ForgotPassword.jsx` (62 email), `pages/ResetPassword.jsx` (72, 79 password), `pages/ChangePassword.jsx` (82, 88, 94 password), `pages/FinishSetup.jsx` (181 text, 204 tel)

- [ ] **Step 1:** In each file add `import SmoothInput from '../components/SmoothInput';` and swap the listed inputs to `<SmoothInput`.
- [ ] **Step 2: Verify** — `/forgot-password` and `/reset-password` render publicly; type and confirm caret + masking. (ChangePassword/FinishSetup are behind auth — covered in Task 7's authed pass; for now confirm the dev server still compiles with no console errors.)
- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ForgotPassword.jsx frontend/src/pages/ResetPassword.jsx frontend/src/pages/ChangePassword.jsx frontend/src/pages/FinishSetup.jsx
git commit -m "feat(web): use SmoothInput across forgot/reset/change-password + finish-setup"
```

---

## Chunk 2: Remaining pages + cross-cutting verification

### Task 5: Wire profile / forms / location

**Files:**
- Modify: `pages/ProfileEdit.jsx` (swap the 15 text inputs listed in the inventory; **skip** 303 file, 397 number, 466 date, 606 file, 693 number), `pages/EmergencyContacts.jsx` (363, 369, 377; skip 383 number), `pages/Feedback.jsx` (170, 175, 180), `components/LocationPrompt.jsx` (41)

- [ ] **Step 1:** Add the import to each file (`ProfileEdit`, `EmergencyContacts`, `Feedback` use `../components/SmoothInput`; `LocationPrompt` is already in `components/`, so `import SmoothInput from './SmoothInput';`).
- [ ] **Step 2:** Swap only the listed text-like inputs. Double-check the `{...f('x')}` / `{...emF('x')}` spreads are preserved verbatim. Leave file/number/date inputs as `<input>`.

- [ ] **Step 2a (flex-row fields — important):** Two of these inputs grow via `flex:1` inside a flex row, so the layout-neutral wrapper would otherwise stop expanding. Move the flex to `wrapperStyle`:

  - `ProfileEdit.jsx:577` — `<input value={newPhone} onChange={...} placeholder="416 555 0123" className="field" style={{ flex: 1 }} />`
    becomes
    `<SmoothInput value={newPhone} onChange={...} placeholder="416 555 0123" className="field" wrapperStyle={{ flex: 1 }} />`
    (the `.field` class already gives the input `width:100%`, so drop the now-redundant `style={{ flex: 1 }}`.)

  - `LocationPrompt.jsx:41` — this input had `flex: 1` but no `width`/`box-sizing`, so the input itself must now fill the wrapper. Move `flex` to `wrapperStyle` and give the input `width:100%; boxSizing:border-box`:
    `<SmoothInput type="text" value={query} onChange={...} placeholder="e.g. Scarborough or M1B 1A1" wrapperStyle={{ flex: 1 }} style={{ width: '100%', boxSizing: 'border-box', height: '40px', padding: '0 14px', fontSize: '15px', color: 'var(--ink-slate)', border: '1px solid #d8d8d8', borderRadius: '9999px', outline: 'none', fontFamily: 'inherit' }} />`
- [ ] **Step 3: Verify** — `/feedback` renders publicly: type in name/email/phone and confirm caret. Confirm the dev server compiles with no console errors for the authed files. **Flex-row check:** in Task 7's authed pass, confirm the ProfileEdit "Change number" field still stretches to fill its row (Save/Cancel buttons unchanged) and the LocationPrompt search field still fills its row next to the button.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProfileEdit.jsx frontend/src/pages/EmergencyContacts.jsx frontend/src/pages/Feedback.jsx frontend/src/components/LocationPrompt.jsx
git commit -m "feat(web): use SmoothInput on profile, emergency contacts, feedback, location"
```

---

### Task 6: Wire admin / dashboards / messages

**Files:**
- Modify: `pages/Admin.jsx` (390 text), `pages/ElderDashboard.jsx` (1040, 1067 text; skip 995 checkbox), `pages/MessagesInbox.jsx` (170 text)

- [ ] **Step 1:** Add the import and swap the listed text-like inputs to `<SmoothInput`.
- [ ] **Step 2:** Confirm `HelperDashboard.jsx` is intentionally untouched (only a checkbox).
- [ ] **Step 3: Verify** — dev server compiles, no console errors.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Admin.jsx frontend/src/pages/ElderDashboard.jsx frontend/src/pages/MessagesInbox.jsx
git commit -m "feat(web): use SmoothInput on admin, elder dashboard, messages"
```

---

### Task 7: Cross-cutting verification (fallbacks + authed pages)

No code changes unless a regression is found.

- [ ] **Step 1: Reduced-motion fallback** — with the webapp-testing skill, emulate `prefers-reduced-motion: reduce` and reload `/login`. Confirm the fields use the **native** caret (no animated bar) and typing works normally.
- [ ] **Step 2: Non-text fallback** — log in via the Login "Try as an Elder" demo button (elder / 12345678), open Profile edit, and confirm the **number** (age) and **date** (date of birth) fields render native inputs that still work (spinner/date picker), and the **file** photo upload still opens a picker.
- [ ] **Step 3: Authed page spot-check** — while logged in, open Profile edit, Emergency contacts, and Messages; type in a couple of text fields and confirm the springy caret appears and layout is unchanged. Screenshot Login, Register, ProfileEdit, Feedback for a visual diff against the pre-change look.
- [ ] **Step 4: Lint the whole frontend**

Run: `cd frontend && npm run lint`
Expected: no new errors introduced by these changes.

- [ ] **Step 5: Stop the dev server.**

- [ ] **Step 6: Final commit** (only if Step 1–3 surfaced fixes; otherwise nothing to commit). Then push `main`.

```bash
git push origin main
```

---

## Done criteria

- `SmoothInput` exists and is used on every text-like input in the 13 files.
- Text fields show a brand-blue springy caret; password fields mask + track; selection/blur hide the caret.
- `number`/`date`/`file`/`checkbox`, `<textarea>`, and reduced-motion users get unchanged native behavior.
- No layout regressions on the spot-checked pages; lint clean; committed and pushed to `main`.
