# Tortoise Shape, Emergency Cleanup, Auto-Age Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the messy tortoise shell in Peekaboo game (redesign as proper SVG), remove the Location Sharing section from EmergencyContacts, and auto-calculate age from DOB in ProfileEdit.

**Architecture:** Three independent frontend-only changes. PeekabooGame gets a full SVG-based game board replacing the div/clip-path approach. EmergencyContacts has one section deleted. ProfileEdit replaces the manual age input with a computed age display derived from the DOB field.

**Tech Stack:** React 18 / React Router v6 / inline styles only · No CSS classes · SF Pro fonts · GREEN=#1a5c2e, SKY=#4FA3CE

---

## Task 1: PeekabooGame.jsx — SVG-based tortoise shell

**Files:**
- Modify: `frontend/src/pages/PeekabooGame.jsx`

**Problem:** The current implementation uses `<div>` elements with `clip-path` for hex shapes, positioned with `marginLeft` and negative `marginTop`. The geometry doesn't produce a clean honeycomb because the bounding boxes are 80×80 (non-regular hexagon) and the overlap value was guessed. The head/tail/legs are absolutely-positioned divs that don't align cleanly.

**Solution:** Replace with a single `<svg>` element. Draw 12 hexagonal cells as `<polygon>` elements using pre-calculated (cx, cy) coordinates. Embed head, tail, and legs as SVG paths within the same SVG. This guarantees pixel-perfect geometry.

### SVG Design

Hex parameters:
- Side length `s = 36`
- Width `W = 2s = 72px` (left vertex to right vertex)
- Height `H = s√3 ≈ 62px` (flat-to-flat vertical span)
- Same-row center spacing: `W + 4 = 76px`
- Row-to-row center spacing: `H + 4 = 66px`
- Shell is NOT staggered (rows align vertically, creating a clean oval carapace)

Cell (cx, cy) positions (2-4-4-2 layout, centered on x=190):
```
Row 0 (2 hexes):  (152, 90),  (228, 90)
Row 1 (4 hexes):   (76,156), (152,156), (228,156), (304,156)
Row 2 (4 hexes):   (76,222), (152,222), (228,222), (304,222)
Row 3 (2 hexes):  (152,288),  (228,288)
```

SVG viewBox: `"0 0 380 400"`

- [ ] **Step 1: Replace HexCard, TortoiseHead, TortoiseTail, TortoiseLeg components**

Delete the four component functions (`HexCard`, `TortoiseHead`, `TortoiseTail`, `TortoiseLeg`) and the `ROWS` constant.

Add these instead:

```jsx
// Flat-top hexagon: vertices at angles 0°, 60°, 120°, 180°, 240°, 300°
function hexPoints(cx, cy, s, inset = 2) {
  const r = s - inset;
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

const POSITIONS = [
  [152, 90], [228, 90],
  [76, 156], [152, 156], [228, 156], [304, 156],
  [76, 222], [152, 222], [228, 222], [304, 222],
  [152, 288], [228, 288],
];
```

- [ ] **Step 2: Replace the `// Map cards to rows` block and the tortoise JSX**

Remove (delete):
```js
// Map cards to rows
let offset = 0;
const rowCards = ROWS.map(([count]) => {
  const slice = cards.slice(offset, offset + count);
  offset += count;
  return slice;
});
```

The SVG renders cards by their position index directly:

- [ ] **Step 3: Replace the `{/* Tortoise body */}` JSX block**

Remove the entire `{/* Tortoise body — centered */}` div (lines 202–249) and replace with this SVG:

```jsx
{/* Tortoise — single SVG */}
<div style={{ display: 'flex', justifyContent: 'center' }}>
  <svg width="380" height="400" viewBox="0 0 380 400" style={{ overflow: 'visible' }}>

    {/* Shell base — soft oval glow */}
    <ellipse cx="190" cy="189" rx="140" ry="115" fill={GREEN} opacity="0.08" />

    {/* Head */}
    <ellipse cx="190" cy="52" rx="20" ry="22" fill={GREEN} />
    <ellipse cx="190" cy="72" rx="13" ry="14" fill={GREEN} />
    <circle cx="183" cy="44" r="4" fill="#f0fdf4" />
    <circle cx="197" cy="44" r="4" fill="#f0fdf4" />
    <circle cx="183" cy="44" r="2" fill="#1d1d1f" />
    <circle cx="197" cy="44" r="2" fill="#1d1d1f" />

    {/* Tail */}
    <ellipse cx="190" cy="315" rx="10" ry="14" fill={GREEN} />
    <path d="M186 325 Q190 345 194 325" fill={GREEN} />

    {/* Front-left leg */}
    <ellipse cx="52" cy="148" rx="14" ry="22"
      fill={GREEN} transform="rotate(-30 52 148)" />

    {/* Front-right leg */}
    <ellipse cx="328" cy="148" rx="14" ry="22"
      fill={GREEN} transform="rotate(30 328 148)" />

    {/* Back-left leg */}
    <ellipse cx="52" cy="230" rx="14" ry="22"
      fill={GREEN} transform="rotate(30 52 230)" />

    {/* Back-right leg */}
    <ellipse cx="328" cy="230" rx="14" ry="22"
      fill={GREEN} transform="rotate(-30 328 230)" />

    {/* Hex cells */}
    {cards.map((card, i) => {
      const [cx, cy] = POSITIONS[i];
      const revealed = card.flipped || card.matched;
      const fill = card.matched ? SKY : revealed ? '#f0fdf4' : GREEN;
      return (
        <g key={card.id} onClick={() => flip(i)}
          style={{ cursor: card.matched ? 'default' : 'pointer' }}>
          <polygon
            points={hexPoints(cx, cy, 36, 3)}
            fill={fill}
            stroke="#fafafc"
            strokeWidth="2"
            style={{ transition: 'fill 0.25s' }}
          />
          {revealed && (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              fill={card.matched ? '#fff' : GREEN}
              fontSize={card.matched ? 16 : 20}
              fontWeight="800"
              fontFamily={SF}
              style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {card.matched ? '✓' : card.num}
            </text>
          )}
        </g>
      );
    })}
  </svg>
</div>
```

- [ ] **Step 4: Verify in browser**

Start the dev server if not running:
```bash
cd /Users/aghar/Documents/Projects/ToWin/frontend && npm run dev
```

Open http://localhost:5173/game and confirm:
- 12 hex cells form a clean oval (2-4-4-2) tortoise shape
- Head appears at the top, tail at the bottom, legs at four corners
- Clicking a cell flips it (shows number, cream background)
- Matched pairs turn sky-blue with ✓
- Timer and progress bar still work correctly

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PeekabooGame.jsx
git commit -m "feat: redesign tortoise game as SVG with proper hexagonal geometry"
```

---

## Task 2: EmergencyContacts.jsx — Remove Location Sharing section

**Files:**
- Modify: `frontend/src/pages/EmergencyContacts.jsx`

**What to delete:** The entire `<BlurFade delay={6}>` block that renders the "Location Sharing" section (the card with two toggles: "Share location with contacts" and "Auto-alert on inactivity"). This block starts after the closing `)}` of the add-contact-form section and ends before the final `</div>` closing the contacts section.

Also delete:
- The `safetyToggles` state: `const [safetyToggles, setSafetyToggles] = useState({ shareLocation: true, autoAlert: true });`
- The `toggleSafety` function: `const toggleSafety = (key) => setSafetyToggles(p => ({ ...p, [key]: !p[key] }));`

- [ ] **Step 1: Read the file to confirm exact line numbers**

Read `frontend/src/pages/EmergencyContacts.jsx` and locate:
1. Line with `const [safetyToggles, setSafetyToggles]`
2. Line with `const toggleSafety`
3. The `{/* Location sharing section */}` comment and its `<BlurFade delay={6}>` block

- [ ] **Step 2: Delete the three items**

Remove:
1. `const [safetyToggles, setSafetyToggles] = useState({ shareLocation: true, autoAlert: true });`
2. `const toggleSafety = (key) => setSafetyToggles(p => ({ ...p, [key]: !p[key] }));`
3. The entire `{/* Location sharing section */}` + `<BlurFade delay={6}>...</BlurFade>` block

- [ ] **Step 3: Verify in browser**

Open http://localhost:5173/emergency-contacts (log in as an elder). Confirm the "Location Sharing" toggles section no longer appears. The page should end with the contact cards and the "+ Add Contact" form.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/EmergencyContacts.jsx
git commit -m "feat: remove local location sharing section from emergency contacts"
```

---

## Task 3: ProfileEdit.jsx — Auto-calculate age from DOB

**Files:**
- Modify: `frontend/src/pages/ProfileEdit.jsx`

**Goal:** Replace the manual "Age" number input with a computed age display derived from the `dateOfBirth` field. When DOB is set, compute age (total days + years/months/days breakdown) and show it as a read-only display exactly like the streak page. The computed `years` value is sent to the backend as `age`.

The `computeAge` function is already in `Streaks.jsx` — copy it to `ProfileEdit.jsx`.

- [ ] **Step 1: Add computeAge helper function**

Add this function near the top of `ProfileEdit.jsx`, after the constants (SF, SFText, etc.) and before the `Stars` component:

```js
function computeAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const now = new Date();
  const totalDays = Math.floor((now - dob) / (1000 * 60 * 60 * 24));
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();
  if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years -= 1; months += 12; }
  return { totalDays, years, months, days };
}
```

- [ ] **Step 2: Replace the Age FieldRow with a computed display**

Find the current Age FieldRow (inside the form):
```jsx
<FieldRow label="Age">
  <input {...f('age')} type="number"
    placeholder={isElder ? '50–120' : '18–80'}
    min={isElder ? 50 : 18} max={isElder ? 120 : 80} required
    style={{ width: '100%', boxSizing: 'border-box' }} />
</FieldRow>
```

Replace with:
```jsx
<FieldRow label="Age">
  {form.dateOfBirth ? (() => {
    const age = computeAge(form.dateOfBirth);
    return age ? (
      <div style={{
        padding: '10px 14px', borderRadius: '12px',
        background: '#f5f5f7', border: '1.5px solid #e0e0e0',
        fontSize: '14px', color: '#1d1d1f', lineHeight: 1.6,
      }}>
        <span style={{ fontWeight: 700, fontSize: '20px', color: '#1a5c2e' }}>
          {age.years}
        </span>
        <span style={{ color: '#7a7a7a' }}> years old</span>
        <br />
        <span style={{ fontSize: '12px', color: '#a0a0a5' }}>
          {age.totalDays.toLocaleString()} days · {age.months} mo {age.days} d
        </span>
      </div>
    ) : null;
  })() : (
    <input {...f('age')} type="number"
      placeholder={isElder ? '50–120' : '18–80'}
      min={isElder ? 50 : 18} max={isElder ? 120 : 80}
      style={{ width: '100%', boxSizing: 'border-box' }} />
  )}
</FieldRow>
```

This shows:
- When DOB is set: computed age breakdown (read-only, no manual entry)
- When DOB is NOT set: the original manual number input (fallback)

- [ ] **Step 3: Update save() to pass computed age to backend**

In the `save()` function, both the elder and helper PUT calls send `age: Number(form.age)`. When DOB is set, `form.age` is empty (since there's no input), so we need to compute it.

Add a helper before the `try` block in `save()`:

```js
const computedAge = form.dateOfBirth ? (computeAge(form.dateOfBirth)?.years ?? Number(form.age)) : Number(form.age);
```

Then replace `age: Number(form.age)` with `age: computedAge` in BOTH the elder PUT and the helper PUT calls.

- [ ] **Step 4: Verify in browser**

1. Log in as any user and go to `/profile`
2. Enter a date of birth in the Date of Birth field
3. Confirm the Age field instantly shows the computed age (e.g. "73 years old" with "26,700 days · 4 mo 12 d")
4. Clear DOB → Age input reappears as a manual number field
5. Save profile → confirm no error, page reloads with correct data

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProfileEdit.jsx
git commit -m "feat: auto-calculate age from date of birth in profile edit"
```
