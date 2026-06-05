# Streaks Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily check-in Streaks page that elder users land on immediately after login — a single big button that records they are alive and active today, building a consecutive-day streak.

**Architecture:** Backend stores one `user_streaks` row per user tracking current streak, longest streak, and last check-in date. A new `StreakController` exposes two endpoints: GET to read the streak, POST to check in. On the frontend, Login redirects ELDER/BOTH users to `/streaks` instead of `/dashboard`; the Streaks page mirrors the login layout (left image panel, right content) and routes to `/dashboard` after check-in.

**Tech Stack:** Spring Boot 3 / JPA / PostgreSQL / Flyway · React 18 / React Router v6 / inline styles · JWT auth (`auth.getName()` = userId UUID)

---

## File Structure

### Backend — new files
| File | Purpose |
|------|---------|
| `backend/src/main/resources/db/migration/V16__create_user_streaks_table.sql` | Flyway migration — creates `user_streaks` table |
| `backend/src/main/java/com/towin/streak/entity/UserStreak.java` | JPA entity — one row per user, tracks streak counts + last check-in date |
| `backend/src/main/java/com/towin/streak/repository/UserStreakRepository.java` | JpaRepository — findByUserId |
| `backend/src/main/java/com/towin/streak/dto/StreakResponse.java` | Response DTO — currentStreak, longestStreak, lastCheckinDate, alreadyCheckedIn |
| `backend/src/main/java/com/towin/streak/service/StreakService.java` | Business logic — checkIn(), getStreak() |
| `backend/src/main/java/com/towin/streak/controller/StreakController.java` | REST controller — GET /api/streaks/me, POST /api/streaks/checkin |
| `backend/src/test/java/com/towin/streak/service/StreakServiceTest.java` | Unit tests — 4 cases covering first check-in, streak increment, streak reset, duplicate check-in |

### Frontend — new files
| File | Purpose |
|------|---------|
| `frontend/src/pages/Streaks.jsx` | Full-page streak check-in — left image panel + right streak UI |

### Frontend — modified files
| File | Change |
|------|--------|
| `frontend/src/App.jsx` | Add `/streaks` route with `ElderOnly` guard; import `Streaks` |
| `frontend/src/pages/Login.jsx` | Change post-login redirect: ELDER/BOTH → `/streaks`, HELPER → `/dashboard`, ADMIN → `/admin` |

---

## Chunk 1: Backend

### Task 1: Database Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V16__create_user_streaks_table.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE user_streaks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_streak  INTEGER NOT NULL DEFAULT 0,
    longest_streak  INTEGER NOT NULL DEFAULT 0,
    last_checkin_date DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Restart backend and verify Flyway applied the migration**

```bash
cd backend && ./mvnw spring-boot:run
# Look for: Successfully applied 1 migration to schema "public" (V16)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V16__create_user_streaks_table.sql
git commit -m "feat: add user_streaks migration V16"
```

---

### Task 2: Entity + Repository

**Files:**
- Create: `backend/src/main/java/com/towin/streak/entity/UserStreak.java`
- Create: `backend/src/main/java/com/towin/streak/repository/UserStreakRepository.java`

- [ ] **Step 1: Write the entity**

```java
package com.towin.streak.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_streaks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserStreak {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(name = "current_streak", nullable = false)
    @Builder.Default
    private int currentStreak = 0;

    @Column(name = "longest_streak", nullable = false)
    @Builder.Default
    private int longestStreak = 0;

    @Column(name = "last_checkin_date")
    private LocalDate lastCheckinDate;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
```

- [ ] **Step 2: Write the repository**

```java
package com.towin.streak.repository;

import com.towin.streak.entity.UserStreak;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserStreakRepository extends JpaRepository<UserStreak, UUID> {
    Optional<UserStreak> findByUserId(UUID userId);
}
```

- [ ] **Step 3: Compile to verify no errors**

```bash
cd backend && ./mvnw compile -q
# Expected: BUILD SUCCESS
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/towin/streak/
git commit -m "feat: UserStreak entity and repository"
```

---

### Task 3: DTO

**Files:**
- Create: `backend/src/main/java/com/towin/streak/dto/StreakResponse.java`

- [ ] **Step 1: Write the DTO**

```java
package com.towin.streak.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class StreakResponse {
    private int currentStreak;
    private int longestStreak;
    private LocalDate lastCheckinDate;
    private boolean alreadyCheckedIn;
}
```

- [ ] **Step 2: Compile**

```bash
cd backend && ./mvnw compile -q
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/towin/streak/dto/StreakResponse.java
git commit -m "feat: StreakResponse DTO"
```

---

### Task 4: Service + Tests

**Files:**
- Create: `backend/src/main/java/com/towin/streak/service/StreakService.java`
- Create: `backend/src/test/java/com/towin/streak/service/StreakServiceTest.java`

- [ ] **Step 1: Write the failing tests first**

```java
package com.towin.streak.service;

import com.towin.streak.dto.StreakResponse;
import com.towin.streak.entity.UserStreak;
import com.towin.streak.repository.UserStreakRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class StreakServiceTest {

    @Mock UserStreakRepository streakRepository;
    @InjectMocks StreakService streakService;

    UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() { MockitoAnnotations.openMocks(this); }

    @Test
    void firstCheckIn_startsStreakAtOne() {
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(streakRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.getCurrentStreak()).isEqualTo(1);
        assertThat(r.isAlreadyCheckedIn()).isFalse();
    }

    @Test
    void consecutiveDayCheckIn_incrementsStreak() {
        UserStreak existing = UserStreak.builder()
                .userId(userId).currentStreak(4).longestStreak(4)
                .lastCheckinDate(LocalDate.now().minusDays(1)).build();
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.of(existing));
        when(streakRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.getCurrentStreak()).isEqualTo(5);
        assertThat(r.getLongestStreak()).isEqualTo(5);
        assertThat(r.isAlreadyCheckedIn()).isFalse();
    }

    @Test
    void missedDayCheckIn_resetsStreakToOne() {
        UserStreak existing = UserStreak.builder()
                .userId(userId).currentStreak(10).longestStreak(10)
                .lastCheckinDate(LocalDate.now().minusDays(3)).build();
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.of(existing));
        when(streakRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.getCurrentStreak()).isEqualTo(1);
        assertThat(r.getLongestStreak()).isEqualTo(10);
        assertThat(r.isAlreadyCheckedIn()).isFalse();
    }

    @Test
    void sameDay_secondCheckIn_returnsAlreadyCheckedIn() {
        UserStreak existing = UserStreak.builder()
                .userId(userId).currentStreak(3).longestStreak(3)
                .lastCheckinDate(LocalDate.now()).build();
        when(streakRepository.findByUserId(userId)).thenReturn(Optional.of(existing));

        StreakResponse r = streakService.checkIn(userId);

        assertThat(r.isAlreadyCheckedIn()).isTrue();
        assertThat(r.getCurrentStreak()).isEqualTo(3);
    }
}
```

- [ ] **Step 2: Run tests — expect FAIL (class not found)**

```bash
cd backend && ./mvnw test -pl . -Dtest=StreakServiceTest -q 2>&1 | tail -5
# Expected: FAIL — StreakService not found
```

- [ ] **Step 3: Write the service**

```java
package com.towin.streak.service;

import com.towin.streak.dto.StreakResponse;
import com.towin.streak.entity.UserStreak;
import com.towin.streak.repository.UserStreakRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StreakService {

    private final UserStreakRepository streakRepository;

    @Transactional
    public StreakResponse checkIn(UUID userId) {
        UserStreak streak = streakRepository.findByUserId(userId)
                .orElseGet(() -> UserStreak.builder().userId(userId).build());

        LocalDate today = LocalDate.now();

        // Already checked in today — return as-is
        if (today.equals(streak.getLastCheckinDate())) {
            return toResponse(streak, true);
        }

        // Consecutive day — increment
        if (streak.getLastCheckinDate() != null &&
                streak.getLastCheckinDate().equals(today.minusDays(1))) {
            streak.setCurrentStreak(streak.getCurrentStreak() + 1);
        } else {
            // Missed a day or first check-in — reset
            streak.setCurrentStreak(1);
        }

        if (streak.getCurrentStreak() > streak.getLongestStreak()) {
            streak.setLongestStreak(streak.getCurrentStreak());
        }

        streak.setLastCheckinDate(today);
        streakRepository.save(streak);

        return toResponse(streak, false);
    }

    public StreakResponse getStreak(UUID userId) {
        UserStreak streak = streakRepository.findByUserId(userId)
                .orElseGet(() -> UserStreak.builder().userId(userId)
                        .currentStreak(0).longestStreak(0).build());
        LocalDate today = LocalDate.now();
        boolean alreadyCheckedIn = today.equals(streak.getLastCheckinDate());
        return toResponse(streak, alreadyCheckedIn);
    }

    private StreakResponse toResponse(UserStreak s, boolean alreadyCheckedIn) {
        return StreakResponse.builder()
                .currentStreak(s.getCurrentStreak())
                .longestStreak(s.getLongestStreak())
                .lastCheckinDate(s.getLastCheckinDate())
                .alreadyCheckedIn(alreadyCheckedIn)
                .build();
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && ./mvnw test -pl . -Dtest=StreakServiceTest -q 2>&1 | tail -5
# Expected: Tests run: 4, Failures: 0, Errors: 0
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/towin/streak/service/ \
        backend/src/test/java/com/towin/streak/
git commit -m "feat: StreakService with TDD — 4 tests passing"
```

---

### Task 5: Controller

**Files:**
- Create: `backend/src/main/java/com/towin/streak/controller/StreakController.java`

- [ ] **Step 1: Write the controller**

```java
package com.towin.streak.controller;

import com.towin.streak.dto.StreakResponse;
import com.towin.streak.service.StreakService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/streaks")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins:http://localhost:5173}")
public class StreakController {

    private final StreakService streakService;

    @GetMapping("/me")
    public ResponseEntity<StreakResponse> getMyStreak(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(streakService.getStreak(userId));
    }

    @PostMapping("/checkin")
    public ResponseEntity<StreakResponse> checkIn(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(streakService.checkIn(userId));
    }
}
```

- [ ] **Step 2: Restart backend and test both endpoints manually**

```bash
# Get a token first (replace with real credentials)
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"elder@test.com","password":"password"}' | jq -r '.token')

# GET streak
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/streaks/me | jq .
# Expected: {"currentStreak":0,"longestStreak":0,"lastCheckinDate":null,"alreadyCheckedIn":false}

# POST check-in
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/streaks/checkin | jq .
# Expected: {"currentStreak":1,"longestStreak":1,"lastCheckinDate":"2026-05-18","alreadyCheckedIn":false}

# POST again (same day)
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/streaks/checkin | jq .
# Expected: {"currentStreak":1,...,"alreadyCheckedIn":true}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/towin/streak/controller/
git commit -m "feat: StreakController — GET /me and POST /checkin"
```

---

## Chunk 2: Frontend

### Task 6: Streaks Page

**Files:**
- Create: `frontend/src/pages/Streaks.jsx`

- [ ] **Step 1: Write the Streaks page**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SKY = '#4FA3CE';

function FlameIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 2 7 7 7 12.5C7 15.5 9 18 12 18C15 18 17 15.5 17 12.5C17 10 15.5 8 14 7C14 9 13 10 12 10C11 10 10 9 10 7.5C10 5.5 12 2 12 2Z"
        fill="#4FA3CE" opacity="0.85"
      />
      <path
        d="M12 13C12 13 10.5 14.5 10.5 16C10.5 17.1 11.2 18 12 18C12.8 18 13.5 17.1 13.5 16C13.5 14.5 12 13 12 13Z"
        fill="#1d1d1f" opacity="0.5"
      />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Streaks() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.get('/streaks/me')
      .then(r => setStreak(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckIn() {
    setChecking(true);
    try {
      const r = await api.post('/streaks/checkin');
      setStreak(r.data);
    } catch {}
    finally { setChecking(false); }
  }

  const alreadyDone = streak?.alreadyCheckedIn;

  return (
    <div style={{ display: 'flex', minHeight: '100svh', fontFamily: SFT }}>

      {/* Left — image panel identical to login/register */}
      <div style={{
        flex: '0 0 42%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '52px 48px', minHeight: '100svh',
      }}>
        <img
          src="/journey.jpg"
          alt="Splinter and the turtles"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center 30%', zIndex: 0,
          }}
        />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to top, rgba(20,55,80,0.65) 0%, rgba(20,55,80,0.28) 50%, rgba(20,55,80,0.04) 100%)',
        }} />
        {/* Logo top-left */}
        <div style={{
          position: 'absolute', top: '32px', left: '48px', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <img src="/logo.png" alt="ToWin logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6 }} />
          <p style={{
            fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.4px',
            fontFamily: SF, margin: 0,
          }}>ToWin</p>
        </div>
        {/* Caption */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{
            fontFamily: SF, fontSize: '36px', lineHeight: 1.15, color: '#fff',
            marginBottom: '14px', letterSpacing: '-0.3px', fontWeight: 600,
            textShadow: '0 2px 24px rgba(20,55,80,0.45)',
          }}>
            Every day<br />counts.
          </h2>
          <p style={{
            fontFamily: SFT, fontSize: '17px', color: 'rgba(255,255,255,0.92)',
            maxWidth: '340px', lineHeight: 1.55, margin: 0,
            textShadow: '0 1px 12px rgba(20,55,80,0.5)',
          }}>
            Showing up today is the most important thing you can do.
          </p>
        </div>
      </div>

      {/* Right — streak content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fafafc', padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Greeting */}
          <p style={{
            fontSize: '18px', color: '#7a7a7a', fontFamily: SFT,
            marginBottom: '8px', fontWeight: 500,
          }}>
            {greeting()}
          </p>
          <h1 style={{
            fontFamily: SF, fontSize: '40px', fontWeight: 700,
            color: '#1d1d1f', letterSpacing: '-0.6px',
            marginBottom: '40px', lineHeight: 1.1,
          }}>
            {alreadyDone ? 'You showed up today.' : 'Ready to check in?'}
          </h1>

          {/* Streak card */}
          <div style={{
            background: '#ffffff', borderRadius: '24px',
            border: '1px solid #e0e0e0', padding: '36px',
            textAlign: 'center', marginBottom: '28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
          }}>
            {loading ? (
              <p style={{ fontSize: '16px', color: '#a0a0a5' }}>Loading…</p>
            ) : (
              <>
                <FlameIcon size={56} />
                <p style={{
                  fontFamily: SF, fontSize: '80px', fontWeight: 800,
                  color: '#1d1d1f', lineHeight: 1, margin: '16px 0 4px',
                  letterSpacing: '-2px',
                }}>
                  {streak?.currentStreak ?? 0}
                </p>
                <p style={{
                  fontSize: '18px', fontWeight: 600, color: '#7a7a7a',
                  fontFamily: SFT, marginBottom: '8px',
                }}>
                  {streak?.currentStreak === 1 ? 'day streak' : 'day streak'}
                </p>
                {streak?.longestStreak > 0 && (
                  <p style={{ fontSize: '14px', color: '#a0a0a5', fontFamily: SFT }}>
                    Best: {streak.longestStreak} {streak.longestStreak === 1 ? 'day' : 'days'}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Action */}
          {!loading && (
            alreadyDone ? (
              <>
                <div style={{
                  background: '#EAF5FB', border: '1px solid #BFD9EA',
                  borderRadius: '14px', padding: '16px 20px',
                  textAlign: 'center', marginBottom: '20px',
                }}>
                  <p style={{ fontSize: '16px', color: '#3D8AB0', fontWeight: 600, fontFamily: SFT, margin: 0 }}>
                    You have already checked in today.
                  </p>
                  <p style={{ fontSize: '14px', color: '#7a7a7a', fontFamily: SFT, margin: '4px 0 0' }}>
                    See you again tomorrow. Keep it going!
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    width: '100%', background: SKY, color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '18px 0', fontSize: '18px', fontWeight: 700,
                    fontFamily: SFT, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(79,163,206,0.3)',
                  }}
                >
                  Continue to Dashboard
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCheckIn}
                  disabled={checking}
                  style={{
                    width: '100%', background: '#1d1d1f', color: '#fff',
                    border: 'none', borderRadius: '9999px',
                    padding: '22px 0', fontSize: '20px', fontWeight: 700,
                    fontFamily: SFT, cursor: checking ? 'default' : 'pointer',
                    marginBottom: '16px', letterSpacing: '-0.2px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    transition: 'opacity 0.15s',
                    opacity: checking ? 0.7 : 1,
                  }}
                >
                  {checking ? 'Marking you present…' : "I'm here today"}
                </button>
                <p style={{
                  textAlign: 'center', fontSize: '14px', color: '#a0a0a5',
                  fontFamily: SFT, lineHeight: 1.5,
                }}>
                  Tap the button to log today and keep your streak alive.
                </p>
              </>
            )
          )}

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls frontend/src/pages/Streaks.jsx
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Streaks.jsx
git commit -m "feat: Streaks page — elder daily check-in with image panel"
```

---

### Task 7: Wire Routes + Login Redirect

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Login.jsx`

- [ ] **Step 1: Add the route in App.jsx**

Find the existing imports at the top of `App.jsx` and add:
```jsx
import Streaks from './pages/Streaks';
```

Find the `<Routes>` block and add the new route (place it after the `/login` route):
```jsx
<Route path="/streaks" element={<ElderOnly><Streaks /></ElderOnly>} />
```

`ElderOnly` already exists in App.jsx — it allows ELDER and BOTH roles, redirects HELPER/ADMIN to `/dashboard`.

- [ ] **Step 2: Update Login.jsx redirect**

Find this line in `Login.jsx` inside the `handleSubmit` function:
```jsx
navigate(data.role === 'ADMIN' ? '/admin' : '/dashboard');
```

Replace with:
```jsx
navigate(
  data.role === 'ADMIN' ? '/admin' :
  (data.role === 'ELDER' || data.role === 'BOTH') ? '/streaks' :
  '/dashboard'
);
```

- [ ] **Step 3: Start frontend and test the flow manually**

```bash
cd frontend && npm run dev
```

Test flow:
1. Log in as an ELDER user → should land on `/streaks`
2. Press "I'm here today" → streak increments, button changes to "Continue to Dashboard"
3. Click "Continue to Dashboard" → lands on `/dashboard`
4. Log out and log back in same day → should land on `/streaks` showing "already checked in"
5. Log in as a HELPER → should land on `/dashboard` directly (skips streaks)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/pages/Login.jsx
git commit -m "feat: route /streaks + redirect elders to streaks after login"
```

---

## Final Verification Checklist

- [ ] Elder user logs in → lands on `/streaks`
- [ ] Helper user logs in → lands on `/dashboard` (no streaks page)
- [ ] Admin user logs in → lands on `/admin`
- [ ] "I'm here today" button calls POST `/api/streaks/checkin` and updates UI
- [ ] Pressing the button a second time (same day) shows "Already checked in" state
- [ ] Streak counter increments on consecutive days
- [ ] Streak resets to 1 after missing a day
- [ ] "Best" longest streak is preserved even after a reset
- [ ] All 4 backend tests pass: `./mvnw test -Dtest=StreakServiceTest`
- [ ] Image panel shows on left (42% width), mirrors login/register layout exactly
- [ ] Page works on mobile width (responsive flex wrapping)
