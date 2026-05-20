# DOB, Age Display & Peekaboo Game Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date-of-birth to registration, show days-lived and precise age on the streak page, and redesign the Peekaboo game with 6 pairs (12 cards) arranged in a real tortoise body shape.

**Architecture:** DOB is stored on the `users` table so it's available immediately after registration for all roles. The streak page fetches `GET /profile/me` (already exists) to get the DOB and computes the age client-side. The game is rewritten in-place — same file, same route, new grid layout using a 2-4-4-2 honeycomb with SVG head, legs, and tail around it.

**Tech Stack:** Spring Boot 3 / JPA / Flyway · React 18 / React Router v6 / inline styles only · SF Pro fonts · sky-blue palette (#4FA3CE, #3D8AB0, #EAF5FB) · dark green (#1a5c2e)

---

## File Map

| File | Change |
|------|--------|
| `backend/src/main/resources/db/migration/V18__add_dob_to_users.sql` | **CREATE** — adds `date_of_birth DATE` to `users` table |
| `backend/src/main/java/com/towin/common/entity/User.java` | **MODIFY** — add `dateOfBirth` field |
| `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java` | **MODIFY** — add optional `dateOfBirth` field |
| `backend/src/main/java/com/towin/auth/service/AuthService.java` | **MODIFY** — save DOB on registration |
| `backend/src/main/java/com/towin/profile/dto/ProfileResponse.java` | already has `dateOfBirth` String — populate from user entity |
| `backend/src/main/java/com/towin/profile/service/ProfileService.java` | **MODIFY** — `buildProfileResponse` populates `dateOfBirth` from user |
| `frontend/src/pages/Register.jsx` | **MODIFY** — add DOB date-picker field, validate, send in payload |
| `frontend/src/pages/Streaks.jsx` | **MODIFY** — fetch `/profile/me`, compute days-lived + age breakdown, render |
| `frontend/src/pages/PeekabooGame.jsx` | **MODIFY** — 6 pairs, 60s timer, tortoise-body grid with SVG anatomy |

---

## Chunk 1: Backend — DOB Storage & API

### Task 1: Flyway migration + User entity + RegisterRequest + AuthService

**Files:**
- Create: `backend/src/main/resources/db/migration/V18__add_dob_to_users.sql`
- Modify: `backend/src/main/java/com/towin/common/entity/User.java`
- Modify: `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java`
- Modify: `backend/src/main/java/com/towin/auth/service/AuthService.java`
- Modify: `backend/src/main/java/com/towin/profile/service/ProfileService.java`

- [ ] **Step 1: Create Flyway migration**

Create `backend/src/main/resources/db/migration/V18__add_dob_to_users.sql`:

```sql
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS date_of_birth DATE;
```

- [ ] **Step 2: Add `dateOfBirth` to User entity**

In `backend/src/main/java/com/towin/common/entity/User.java`, add after `updatedAt`:

```java
import java.time.LocalDate;

@Column(name = "date_of_birth")
private LocalDate dateOfBirth;
```

Also add `LocalDate` to the imports (add `java.time.LocalDate` — `java.time.LocalDateTime` is already imported, just add the new one).

- [ ] **Step 3: Add `dateOfBirth` to RegisterRequest**

In `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java`:

```java
import java.time.LocalDate;

// add this field (nullable — optional at registration):
private LocalDate dateOfBirth;
```

Full file after change:
```java
package com.towin.auth.dto;

import com.towin.common.enums.UserRole;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.LocalDate;

@Data
public class RegisterRequest {
    @Email @NotBlank
    private String email;

    @NotBlank @Pattern(regexp = "^\\+?[0-9]{10,15}$", message = "Invalid phone number")
    private String phone;

    @NotBlank @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @NotNull
    private UserRole role;

    private LocalDate dateOfBirth;
}
```

- [ ] **Step 4: Save DOB in AuthService.register()**

In `backend/src/main/java/com/towin/auth/service/AuthService.java`, update the `User.builder()` block inside `register()`:

```java
User user = User.builder()
        .email(request.getEmail())
        .phone(request.getPhone())
        .passwordHash(passwordEncoder.encode(request.getPassword()))
        .role(request.getRole())
        .dateOfBirth(request.getDateOfBirth())
        .build();
```

- [ ] **Step 5: Expose DOB from ProfileService.buildProfileResponse()**

In `backend/src/main/java/com/towin/profile/service/ProfileService.java`, update `buildProfileResponse()`. The user entity now has `dateOfBirth`. Add it to the builder **before** the `if (elder != null)` block so it applies for all roles:

```java
ProfileResponse.ProfileResponseBuilder builder = ProfileResponse.builder()
        .userId(user.getId())
        .role(user.getRole().name())
        .trustScore(score)
        .trustTier(TrustScoreService.tierFor(score))
        .verificationStatus(user.getVerificationStatus().name())
        .phoneVerified(user.isPhoneVerified())
        .phone(user.getPhone())
        .city(user.getCity())
        .dateOfBirth(user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null);
```

Remove the `.dateOfBirth(...)` line from the `if (helper != null)` block (it's now on the user, not the helper profile) — find this line and delete it:
```java
// DELETE this line inside the `if (helper != null)` block:
.dateOfBirth(helper.getDateOfBirth() != null ? helper.getDateOfBirth().toString() : null);
```

- [ ] **Step 6: Build backend and verify it starts**

```bash
cd backend
./mvnw spring-boot:run -q 2>&1 | grep -E "Started|ERROR" | head -5
```

Expected: `Started ToWinApplication` with no ERROR lines. The migration V18 runs automatically on startup.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/migration/V18__add_dob_to_users.sql \
        backend/src/main/java/com/towin/common/entity/User.java \
        backend/src/main/java/com/towin/auth/dto/RegisterRequest.java \
        backend/src/main/java/com/towin/auth/service/AuthService.java \
        backend/src/main/java/com/towin/profile/service/ProfileService.java
git commit -m "feat: add date_of_birth to users table, registration DTO, and profile response"
```

---

## Chunk 2: Frontend Registration — DOB Field

### Task 2: Add DOB date-picker to Register.jsx

**Files:**
- Modify: `frontend/src/pages/Register.jsx`

- [ ] **Step 1: Add `dateOfBirth` to form state**

Find the `useState` initializer for `form` (currently `{ email: '', phone: '', password: '', confirmPassword: '', role: 'ELDER' }`) and add `dateOfBirth: ''`:

```js
const [form, setForm] = useState({
  email: '', phone: '', password: '', confirmPassword: '',
  role: 'ELDER', dateOfBirth: '',
});
```

- [ ] **Step 2: Add DOB validation in handleSubmit**

Inside `handleSubmit`, after the existing `errs` checks, add:

```js
if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
else {
  const dob = new Date(form.dateOfBirth);
  const minAge = new Date();
  minAge.setFullYear(minAge.getFullYear() - 18);
  if (dob > minAge) errs.dateOfBirth = 'You must be at least 18 years old';
}
```

- [ ] **Step 3: Include dateOfBirth in registration payload**

Find the `api.post('/auth/register', ...)` line and update:

```js
const { email, phone, password, role, dateOfBirth } = form;
const { data } = await api.post('/auth/register', { email, phone, password, role, dateOfBirth });
```

- [ ] **Step 4: Add DOB input field in the form JSX**

Add the DOB field after the Phone field and before the Password field. Find the closing `</div>` of the Phone block and insert after it:

```jsx
{/* Date of Birth */}
<div>
  <label style={{
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: '#1d1d1f', marginBottom: '6px',
    fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
  }}>
    Date of birth
  </label>
  <input
    type="date"
    required
    className="field"
    value={form.dateOfBirth}
    max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().split('T')[0]; })()}
    onChange={e => { setForm({ ...form, dateOfBirth: e.target.value }); setFieldErrors(f => ({ ...f, dateOfBirth: '' })); }}
    style={{ borderColor: fieldErrors.dateOfBirth ? '#fca5a5' : undefined }}
  />
  {fieldErrors.dateOfBirth && (
    <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontFamily: 'inherit' }}>
      {fieldErrors.dateOfBirth}
    </p>
  )}
</div>
```

- [ ] **Step 5: Also fix the post-register redirect**

Currently `Register.jsx` navigates to `'/dashboard'` after registration. Change it to navigate elders/both to `/streaks` (same as login):

```js
navigate(
  data.role === 'ADMIN' ? '/admin' :
  (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' :
  '/dashboard'
);
```

- [ ] **Step 6: Test in browser**

Open `http://localhost:5173/register`. Fill out the form including date of birth. Submit. Verify:
- Elders/Both redirect to `/streaks`
- Helpers redirect to `/dashboard`
- DOB validation blocks users under 18

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Register.jsx
git commit -m "feat: add date of birth field to registration form"
```

---

## Chunk 3: Streak Page — Days Lived & Age Display

### Task 3: Show days-lived and precise age on Streaks.jsx

**Files:**
- Modify: `frontend/src/pages/Streaks.jsx`

**Context:** `GET /api/profile/me` returns `{ dateOfBirth: "1995-03-15", ... }`. We fetch this alongside the streak data and compute the age client-side. No backend changes needed.

- [ ] **Step 1: Add age computation helpers at the top of Streaks.jsx**

After the `greeting()` function, add:

```js
function computeAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const now = new Date();

  const totalDays = Math.floor((now - dob) / (1000 * 60 * 60 * 24));

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { totalDays, years, months, days };
}
```

- [ ] **Step 2: Add profile state and fetch to Streaks component**

Add `dob` state and fetch it alongside the streak. In `export default function Streaks()`, add:

```js
const [dob, setDob] = useState(null);

// Inside the existing useEffect (or add a second one):
useEffect(() => {
  api.get('/profile/me')
    .then(r => setDob(r.data.dateOfBirth))
    .catch(() => {});
}, []);
```

- [ ] **Step 3: Render the age card below the streak card**

In the JSX, after the closing `</div>` of the streak card (the white card with the flame icon and streak number), add:

```jsx
{/* Age display card */}
{dob && (() => {
  const age = computeAge(dob);
  if (!age) return null;
  return (
    <div style={{
      background: '#ffffff', borderRadius: '20px',
      border: '1px solid #e0e0e0', padding: '24px 28px',
      marginBottom: '28px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    }}>
      <p style={{
        fontFamily: SF, fontSize: '40px', fontWeight: 800,
        color: '#1a5c2e', lineHeight: 1, margin: '0 0 6px',
        letterSpacing: '-1px',
      }}>
        {age.totalDays.toLocaleString()}
      </p>
      <p style={{
        fontSize: '15px', fontWeight: 600, color: '#7a7a7a',
        fontFamily: SFT, margin: '0 0 10px',
      }}>
        days you have lived
      </p>
      <p style={{
        fontSize: '14px', color: '#a0a0a5', fontFamily: SFT, margin: 0,
      }}>
        {age.years} {age.years === 1 ? 'year' : 'years'},{' '}
        {age.months} {age.months === 1 ? 'month' : 'months'},{' '}
        {age.days} {age.days === 1 ? 'day' : 'days'} old
      </p>
    </div>
  );
})()}
```

- [ ] **Step 4: Test in browser**

Register a new elder with a known DOB (e.g. 1995-03-15). Go to `/streaks`. Verify:
- The age card appears below the streak counter
- The total days number is correct (verify with a calculator: today 2026-05-20, DOB 1995-03-15 → ~11,388 days)
- The years/months/days line is correct (31 years, 2 months, 5 days)
- If user has no DOB set, the age card is simply hidden

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Streaks.jsx
git commit -m "feat: show days lived and precise age on streak page"
```

---

## Chunk 4: Peekaboo Game — 6 Pairs + Tortoise Body Layout

### Task 4: Redesign PeekabooGame.jsx — 6 pairs, 60s, tortoise anatomy

**Files:**
- Modify: `frontend/src/pages/PeekabooGame.jsx`

**Design:** 12 hexagonal shells in a 2-4-4-2 honeycomb arrangement form the tortoise carapace. SVG elements for head (top center), tail (bottom center), front-left leg, front-right leg, back-left leg, back-right leg surround the shell grid — none are interactive. Total card count: 12 (6 pairs, numbers 1–6 each appearing twice).

**Grid layout (hex size 80×80px, gap 6px):**
```
       [  ] [  ]           ← row 0: 2 hexes, marginLeft = 43px
    [  ] [  ] [  ] [  ]    ← row 1: 4 hexes, marginLeft = 0
    [  ] [  ] [  ] [  ]    ← row 2: 4 hexes, marginLeft = 0
       [  ] [  ]           ← row 3: 2 hexes, marginLeft = 43px
```
Row overlap: `marginTop: -18px` for rows 1–3 (honeycomb vertical compression).

**Body part positioning** (all `position: absolute`, parent has `position: relative`):
- Head: top center, `top: -52px, left: 50%, transform: translateX(-50%)`
- Tail: bottom center, `bottom: -52px, left: 50%, transform: translateX(-50%)`
- Front-left leg: `top: 10px, left: -52px`
- Front-right leg: `top: 10px, right: -52px`
- Back-left leg: `bottom: 10px, left: -52px`
- Back-right leg: `bottom: 10px, right: -52px`

- [ ] **Step 1: Replace PeekabooGame.jsx completely**

Write the full replacement for `frontend/src/pages/PeekabooGame.jsx`:

```jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const HEX   = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
const GREEN = '#1a5c2e';
const SKY   = '#4FA3CE';
const PAIRS = 6;
const TIME  = 60;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initCards() {
  const nums = Array.from({ length: PAIRS }, (_, i) => i + 1);
  return shuffle([...nums, ...nums]).map((num, i) => ({
    id: i, num, flipped: false, matched: false,
  }));
}

function HexCard({ card, onClick }) {
  const revealed = card.flipped || card.matched;
  return (
    <div
      onClick={onClick}
      style={{
        width: 80, height: 80,
        clipPath: HEX,
        background: card.matched ? SKY : revealed ? '#f0fdf4' : GREEN,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: card.matched ? 'default' : 'pointer',
        transition: 'background 0.25s',
        userSelect: 'none', flexShrink: 0,
        border: 'none', outline: 'none',
      }}
    >
      {revealed && (
        <span style={{
          fontSize: card.matched ? '20px' : '26px',
          fontWeight: 800,
          color: card.matched ? '#fff' : GREEN,
          fontFamily: SF, lineHeight: 1,
        }}>
          {card.matched ? '✓' : card.num}
        </span>
      )}
    </div>
  );
}

// SVG tortoise body parts
function TortoiseHead() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="24" cy="28" rx="14" ry="16" fill={GREEN} />
      <ellipse cx="24" cy="16" rx="10" ry="12" fill={GREEN} />
      <circle cx="20" cy="13" r="2.5" fill="#f0fdf4" />
      <circle cx="28" cy="13" r="2.5" fill="#f0fdf4" />
      <circle cx="20" cy="13" r="1.2" fill="#1d1d1f" />
      <circle cx="28" cy="13" r="1.2" fill="#1d1d1f" />
    </svg>
  );
}

function TortoiseTail() {
  return (
    <svg width="24" height="36" viewBox="0 0 24 36" fill="none">
      <ellipse cx="12" cy="12" rx="9" ry="10" fill={GREEN} />
      <path d="M8 18 Q12 36 16 18" fill={GREEN} />
    </svg>
  );
}

function TortoiseLeg({ rotate = 0 }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none"
      style={{ transform: `rotate(${rotate}deg)` }}>
      <ellipse cx="22" cy="22" rx="12" ry="18" fill={GREEN} />
      <ellipse cx="22" cy="34" rx="9" ry="6" fill={GREEN} />
    </svg>
  );
}

// Row config: [count, marginLeft]
const ROWS = [
  [2, 43],
  [4,  0],
  [4,  0],
  [2, 43],
];

export default function PeekabooGame() {
  const navigate = useNavigate();
  const [cards, setCards]       = useState(initCards);
  const [selected, setSelected] = useState([]);
  const [locked, setLocked]     = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [phase, setPhase]       = useState('playing');
  const checkedIn = useRef(false);

  useEffect(() => {
    if (!checkedIn.current) {
      checkedIn.current = true;
      api.post('/streaks/checkin').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) { setPhase('lost'); return; }
    const t = setTimeout(() => setTimeLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase]);

  useEffect(() => {
    if (phase === 'playing' && cards.every(c => c.matched)) setPhase('won');
  }, [cards, phase]);

  function flip(idx) {
    if (locked || phase !== 'playing') return;
    const card = cards[idx];
    if (card.flipped || card.matched || selected.length >= 2) return;

    const next = [...selected, idx];
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, flipped: true } : c));
    setSelected(next);

    if (next.length === 2) {
      setLocked(true);
      const [a, b] = next;
      setTimeout(() => {
        setCards(prev => {
          const hit = prev[a].num === prev[b].num;
          return prev.map((c, i) =>
            i === a || i === b
              ? hit ? { ...c, matched: true, flipped: false } : { ...c, flipped: false }
              : c
          );
        });
        setSelected([]);
        setLocked(false);
      }, 1200);
    }
  }

  const matchedCount  = cards.filter(c => c.matched).length / 2;
  const timerPct      = timeLeft / TIME;
  const timerColor    = timeLeft <= 15 ? '#dc2626' : timeLeft <= 30 ? '#F5B400' : GREEN;

  // Build card index per row
  let cardIdx = 0;
  const rowCards = ROWS.map(([count]) => {
    const slice = cards.slice(cardIdx, cardIdx + count);
    cardIdx += count;
    return slice;
  });

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc', fontFamily: SFT }}>
      <NavBar />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px', gap: '16px' }}>
          <div>
            <h1 style={{
              fontFamily: SF, fontSize: '38px', fontWeight: 800,
              color: GREEN, margin: 0, letterSpacing: '-0.8px', lineHeight: 1,
            }}>
              Peekaboo!
            </h1>
            <p style={{ fontSize: '14px', color: '#7a7a7a', margin: '5px 0 0' }}>
              Match all {PAIRS} pairs to win
            </p>
          </div>

          {/* Timer ring */}
          <div style={{ flexShrink: 0, position: 'relative', width: 68, height: 68 }}>
            <svg width="68" height="68" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="34" cy="34" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle cx="34" cy="34" r="28" fill="none" stroke={timerColor}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - timerPct)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: SF, fontSize: '18px', fontWeight: 800, color: timerColor, lineHeight: 1, transition: 'color 0.3s' }}>
                {timeLeft}
              </span>
              <span style={{ fontSize: '9px', color: '#a0a0a5' }}>SEC</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '36px' }}>
          <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: SKY, borderRadius: '9999px',
              width: `${(matchedCount / PAIRS) * 100}%`,
              transition: 'width 0.4s',
            }} />
          </div>
          <span style={{ fontSize: '14px', color: '#7a7a7a', fontWeight: 700, flexShrink: 0 }}>
            {matchedCount}/{PAIRS}
          </span>
        </div>

        {/* Tortoise body — centered */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>

            {/* Head */}
            <div style={{
              position: 'absolute', top: '-52px',
              left: '50%', transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}>
              <TortoiseHead />
            </div>

            {/* Tail */}
            <div style={{
              position: 'absolute', bottom: '-48px',
              left: '50%', transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}>
              <TortoiseTail />
            </div>

            {/* Front-left leg */}
            <div style={{
              position: 'absolute', top: '8px', left: '-46px',
              pointerEvents: 'none',
            }}>
              <TortoiseLeg rotate={-30} />
            </div>

            {/* Front-right leg */}
            <div style={{
              position: 'absolute', top: '8px', right: '-46px',
              pointerEvents: 'none',
            }}>
              <TortoiseLeg rotate={30} />
            </div>

            {/* Back-left leg */}
            <div style={{
              position: 'absolute', bottom: '8px', left: '-46px',
              pointerEvents: 'none',
            }}>
              <TortoiseLeg rotate={30} />
            </div>

            {/* Back-right leg */}
            <div style={{
              position: 'absolute', bottom: '8px', right: '-46px',
              pointerEvents: 'none',
            }}>
              <TortoiseLeg rotate={-30} />
            </div>

            {/* Shell grid (2-4-4-2) */}
            <div>
              {ROWS.map(([count, ml], rowIdx) => (
                <div key={rowIdx} style={{
                  display: 'flex',
                  gap: '6px',
                  marginLeft: `${ml}px`,
                  marginTop: rowIdx === 0 ? '0' : '-18px',
                }}>
                  {rowCards[rowIdx].map((card, colIdx) => {
                    const globalIdx = ROWS.slice(0, rowIdx).reduce((s, [c]) => s + c, 0) + colIdx;
                    return (
                      <HexCard
                        key={card.id}
                        card={card}
                        onClick={() => flip(globalIdx)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: '72px' }}>
          <button
            onClick={() => navigate('/streaks')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#a0a0a5', fontFamily: SFT,
              textDecoration: 'underline', padding: '8px',
            }}
          >
            Skip game
          </button>
        </div>
      </div>

      {/* Result overlay */}
      {phase !== 'playing' && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200,
        }}>
          <div style={{
            background: '#fff', borderRadius: '28px',
            padding: '48px 40px', maxWidth: '340px', width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <img src="/logo.png" alt="tortoise" style={{
              width: 80, height: 80, objectFit: 'contain', marginBottom: '16px',
              filter: 'drop-shadow(0 4px 16px rgba(26,92,46,0.25))',
            }} />
            <h2 style={{
              fontFamily: SF, fontSize: '28px', fontWeight: 800,
              color: '#1d1d1f', margin: '0 0 10px', letterSpacing: '-0.4px',
            }}>
              {phase === 'won' ? 'You found them all!' : "Time's up!"}
            </h2>
            <p style={{
              fontSize: '15px', color: '#7a7a7a',
              margin: '0 0 28px', lineHeight: 1.55, fontFamily: SFT,
            }}>
              {phase === 'won'
                ? `All ${PAIRS} pairs matched. Your streak keeps going!`
                : `You got ${matchedCount} of ${PAIRS}. Streak still counts!`}
            </p>
            <button
              onClick={() => navigate('/streaks')}
              style={{
                width: '100%', background: GREEN, color: '#fff',
                border: 'none', borderRadius: '9999px',
                padding: '16px 0', fontSize: '17px', fontWeight: 700,
                fontFamily: SFT, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(26,92,46,0.3)',
              }}
            >
              See my streak →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd frontend
npm run build 2>&1 | tail -8
```
Expected: `✓ built in X ms` with no errors.

- [ ] **Step 3: Test in browser**

Go to `http://localhost:5173/streaks`, click "I'm here today". Verify:
- The game loads with a tortoise body (head at top, tail at bottom, 4 legs at corners)
- 12 hexagonal shells form the carapace (2-4-4-2 pattern)
- Tapping a shell reveals a number (1–6)
- Tapping a matching second shell → both turn sky-blue with ✓
- Mismatch → both flip back after 1.2s
- Timer counts down from 60s (red at ≤15s)
- Completing all 6 pairs shows win modal
- Timer running out shows lose modal
- Both modals have "See my streak →" button
- Skip link works

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PeekabooGame.jsx
git commit -m "feat: redesign peekaboo game — 6 pairs, 60s timer, tortoise body layout"
```
