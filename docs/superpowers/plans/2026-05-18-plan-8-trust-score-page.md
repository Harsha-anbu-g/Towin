# Trust Score Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/trust` page (and NavBar tab) showing every user their live trust score breakdown — each criterion with earned vs max points — matching the existing sky-blue/leaf-green, SF Pro, white-card UI.

**Architecture:** Extend the existing `TrustController` with a new `GET /api/trust/my-score` endpoint backed by a new `getMyScoreBreakdown` method on `TrustScoreService`. The method reuses the exact same queries already in `recalculate()` but returns a structured DTO instead of persisting. The frontend adds a `Trust.jsx` page, registers it in `App.jsx`, and adds a NavBar link — no new context or state-management needed.

**Tech Stack:** Spring Boot (Java 21), JPA, Lombok, JUnit 5 + Mockito; React 18, React Router v6, inline styles matching existing palette.

---

## Chunk 1: Backend — DTO + Service Method + Endpoint

### Task 1: Add `TrustScoreBreakdownResponse` DTO

**Files:**
- Create: `backend/src/main/java/com/towin/trust/dto/TrustScoreBreakdownResponse.java`

- [ ] **Step 1: Create the DTO**

```java
package com.towin.trust.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class TrustScoreBreakdownResponse {

    private int totalScore;
    private int maxScore;
    private String tier;
    private List<Criterion> criteria;

    @Data
    @Builder
    public static class Criterion {
        private String key;        // e.g. "phone_verified"
        private String label;      // e.g. "Phone Verified"
        private int earned;        // points this user actually has
        private int max;           // maximum possible for this criterion
        private String detail;     // e.g. "3 trusted connections"
        private boolean positive;  // false for penalties (reports)
    }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && ./mvnw compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/towin/trust/dto/TrustScoreBreakdownResponse.java
git commit -m "feat(trust): add TrustScoreBreakdownResponse DTO"
```

---

### Task 2: Add `getMyScoreBreakdown` to `TrustScoreService`

**Files:**
- Modify: `backend/src/main/java/com/towin/common/service/TrustScoreService.java`

The method mirrors the logic in `recalculate()` but returns a breakdown DTO instead of persisting. **Do not remove or change `recalculate()`.**

- [ ] **Step 1: Write the failing test first**

Open `backend/src/test/java/com/towin/trust/service/TrustServiceTest.java` — **add a new test class** (separate file, same package) for `TrustScoreService`:

Create: `backend/src/test/java/com/towin/trust/service/TrustScoreServiceTest.java`

```java
package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ApplicationStatus;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.NeedStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrustScoreServiceTest {

    @Mock UserRepository userRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock ReportRepository reportRepository;
    @Mock ConnectionRepository connectionRepository;
    @Mock NeedApplicationRepository needApplicationRepository;

    @InjectMocks TrustScoreService trustScoreService;

    private User user;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = User.builder()
                .id(userId)
                .email("test@example.com")
                .phone("1234567890")
                .passwordHash("hash")
                .phoneVerified(true)
                .verificationStatus(VerificationStatus.NONE)
                .trustScore(0)
                .isActive(true)
                .createdAt(LocalDateTime.now().minusDays(60))
                .build();
    }

    @Test
    void breakdownContainsAllSevenCriteria() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.countTrustedByUser(eq(userId), eq(TrustLevel.TRUSTED), eq(ConnectionStatus.ACTIVE))).thenReturn(0L);
        when(needApplicationRepository.countCompletedByHelper(eq(userId), eq(ApplicationStatus.ACCEPTED), eq(NeedStatus.COMPLETED))).thenReturn(0L);
        when(reviewRepository.findAverageRatingByRevieweeId(userId)).thenReturn(null);
        when(reportRepository.countByReportedUserId(userId)).thenReturn(0L);

        TrustScoreBreakdownResponse breakdown = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(breakdown.getCriteria()).hasSize(7);
        assertThat(breakdown.getTotalScore()).isGreaterThanOrEqualTo(0);
        assertThat(breakdown.getMaxScore()).isEqualTo(95);
    }

    @Test
    void phoneVerifiedEarns10Points() {
        user.setPhoneVerified(true);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.countTrustedByUser(any(), any(), any())).thenReturn(0L);
        when(needApplicationRepository.countCompletedByHelper(any(), any(), any())).thenReturn(0L);
        when(reviewRepository.findAverageRatingByRevieweeId(any())).thenReturn(null);
        when(reportRepository.countByReportedUserId(any())).thenReturn(0L);

        TrustScoreBreakdownResponse breakdown = trustScoreService.getMyScoreBreakdown(userId);

        TrustScoreBreakdownResponse.Criterion phoneCriterion = breakdown.getCriteria().stream()
                .filter(c -> c.getKey().equals("phone_verified"))
                .findFirst().orElseThrow();
        assertThat(phoneCriterion.getEarned()).isEqualTo(10);
        assertThat(phoneCriterion.getMax()).isEqualTo(10);
    }

    @Test
    void idVerifiedEarns20Points() {
        user.setVerificationStatus(VerificationStatus.VERIFIED);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.countTrustedByUser(any(), any(), any())).thenReturn(0L);
        when(needApplicationRepository.countCompletedByHelper(any(), any(), any())).thenReturn(0L);
        when(reviewRepository.findAverageRatingByRevieweeId(any())).thenReturn(null);
        when(reportRepository.countByReportedUserId(any())).thenReturn(0L);

        TrustScoreBreakdownResponse breakdown = trustScoreService.getMyScoreBreakdown(userId);

        TrustScoreBreakdownResponse.Criterion idCriterion = breakdown.getCriteria().stream()
                .filter(c -> c.getKey().equals("id_verified"))
                .findFirst().orElseThrow();
        assertThat(idCriterion.getEarned()).isEqualTo(20);
    }

    @Test
    void trustedConnectionsEarns5PerConnectionMax25() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.countTrustedByUser(eq(userId), eq(TrustLevel.TRUSTED), eq(ConnectionStatus.ACTIVE))).thenReturn(3L);
        when(needApplicationRepository.countCompletedByHelper(any(), any(), any())).thenReturn(0L);
        when(reviewRepository.findAverageRatingByRevieweeId(any())).thenReturn(null);
        when(reportRepository.countByReportedUserId(any())).thenReturn(0L);

        TrustScoreBreakdownResponse breakdown = trustScoreService.getMyScoreBreakdown(userId);

        TrustScoreBreakdownResponse.Criterion c = breakdown.getCriteria().stream()
                .filter(x -> x.getKey().equals("trusted_connections"))
                .findFirst().orElseThrow();
        assertThat(c.getEarned()).isEqualTo(15); // 3 × 5
        assertThat(c.getMax()).isEqualTo(25);
    }

    @Test
    void reportsDeductPoints() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(connectionRepository.countTrustedByUser(any(), any(), any())).thenReturn(0L);
        when(needApplicationRepository.countCompletedByHelper(any(), any(), any())).thenReturn(0L);
        when(reviewRepository.findAverageRatingByRevieweeId(any())).thenReturn(null);
        when(reportRepository.countByReportedUserId(userId)).thenReturn(1L);

        TrustScoreBreakdownResponse breakdown = trustScoreService.getMyScoreBreakdown(userId);

        TrustScoreBreakdownResponse.Criterion c = breakdown.getCriteria().stream()
                .filter(x -> x.getKey().equals("reports"))
                .findFirst().orElseThrow();
        assertThat(c.getEarned()).isEqualTo(-15);
        assertThat(c.isPositive()).isFalse();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw test -pl . -Dtest=TrustScoreServiceTest -q 2>&1 | tail -20
```
Expected: FAIL — `getMyScoreBreakdown` method does not exist yet.

- [ ] **Step 3: Implement `getMyScoreBreakdown` in `TrustScoreService`**

Add this method to `TrustScoreService.java` (after the existing `recalculate` method, before `tierFor`):

```java
public TrustScoreBreakdownResponse getMyScoreBreakdown(UUID userId) {
    User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

    List<TrustScoreBreakdownResponse.Criterion> criteria = new java.util.ArrayList<>();

    // 1. Phone verified (+10)
    int phoneEarned = user.isPhoneVerified() ? 10 : 0;
    criteria.add(TrustScoreBreakdownResponse.Criterion.builder()
            .key("phone_verified")
            .label("Phone Verified")
            .earned(phoneEarned)
            .max(10)
            .detail(user.isPhoneVerified() ? "Verified" : "Not verified yet")
            .positive(true)
            .build());

    // 2. ID verified (+20)
    int idEarned = user.getVerificationStatus() == VerificationStatus.VERIFIED ? 20 : 0;
    String idDetail = switch (user.getVerificationStatus()) {
        case VERIFIED -> "Identity confirmed";
        case PENDING -> "Review in progress";
        default -> "Not submitted";
    };
    criteria.add(TrustScoreBreakdownResponse.Criterion.builder()
            .key("id_verified")
            .label("ID Verified")
            .earned(idEarned)
            .max(20)
            .detail(idDetail)
            .positive(true)
            .build());

    // 3. Trusted connections (+5 each, max 25)
    long trustedCount = connectionRepository.countTrustedByUser(userId, TrustLevel.TRUSTED, ConnectionStatus.ACTIVE);
    int trustedEarned = (int) Math.min(trustedCount * 5L, 25);
    criteria.add(TrustScoreBreakdownResponse.Criterion.builder()
            .key("trusted_connections")
            .label("Trusted Connections")
            .earned(trustedEarned)
            .max(25)
            .detail(trustedCount + (trustedCount == 1 ? " trusted connection" : " trusted connections"))
            .positive(true)
            .build());

    // 4. Completed services (+3 each, max 15)
    long completedServices = needApplicationRepository.countCompletedByHelper(userId, ApplicationStatus.ACCEPTED, NeedStatus.COMPLETED);
    int servicesEarned = (int) Math.min(completedServices * 3L, 15);
    criteria.add(TrustScoreBreakdownResponse.Criterion.builder()
            .key("completed_services")
            .label("Completed Services")
            .earned(servicesEarned)
            .max(15)
            .detail(completedServices + (completedServices == 1 ? " service completed" : " services completed"))
            .positive(true)
            .build());

    // 5. Average review rating (0–10)
    Double avgRating = reviewRepository.findAverageRatingByRevieweeId(userId);
    int ratingEarned = avgRating != null ? (int) Math.round((avgRating - 1.0) / 4.0 * 10.0) : 0;
    String ratingDetail = avgRating != null
            ? String.format("%.1f★ average rating", avgRating)
            : "No reviews yet";
    criteria.add(TrustScoreBreakdownResponse.Criterion.builder()
            .key("avg_rating")
            .label("Community Rating")
            .earned(ratingEarned)
            .max(10)
            .detail(ratingDetail)
            .positive(true)
            .build());

    // 6. Account age > 30 days (+5)
    int ageEarned = user.getCreatedAt().isBefore(LocalDateTime.now().minusDays(30)) ? 5 : 0;
    criteria.add(TrustScoreBreakdownResponse.Criterion.builder()
            .key("account_age")
            .label("Established Member")
            .earned(ageEarned)
            .max(5)
            .detail(ageEarned > 0 ? "Account over 30 days old" : "Account less than 30 days old")
            .positive(true)
            .build());

    // 7. Reports (−15 each, penalty)
    long reportCount = reportRepository.countByReportedUserId(userId);
    int reportsEarned = (int) -(reportCount * 15L);
    criteria.add(TrustScoreBreakdownResponse.Criterion.builder()
            .key("reports")
            .label("Safety Reports")
            .earned(reportsEarned)
            .max(0)
            .detail(reportCount == 0 ? "No reports against you" : reportCount + " report(s) received")
            .positive(false)
            .build());

    int total = criteria.stream().mapToInt(TrustScoreBreakdownResponse.Criterion::getEarned).sum();
    total = Math.max(0, Math.min(100, total));

    return TrustScoreBreakdownResponse.builder()
            .totalScore(total)
            .maxScore(95)
            .tier(tierFor(total))
            .criteria(criteria)
            .build();
}
```

Also add this import at the top of `TrustScoreService.java`:
```java
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import java.util.List;
```

- [ ] **Step 4: Run tests — they must all pass**

```bash
cd backend && ./mvnw test -pl . -Dtest=TrustScoreServiceTest -q 2>&1 | tail -20
```
Expected: `Tests run: 5, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/towin/common/service/TrustScoreService.java \
        backend/src/main/java/com/towin/trust/dto/TrustScoreBreakdownResponse.java \
        backend/src/test/java/com/towin/trust/service/TrustScoreServiceTest.java
git commit -m "feat(trust): add getMyScoreBreakdown method to TrustScoreService"
```

---

### Task 3: Expose `GET /api/trust/my-score` endpoint

**Files:**
- Modify: `backend/src/main/java/com/towin/trust/controller/TrustController.java`

No security changes needed — all authenticated routes already pass through `JwtAuthFilter` and `/api/trust/**` is covered by `.anyRequest().authenticated()` in `SecurityConfig`.

- [ ] **Step 1: Add the endpoint to `TrustController`**

Add this import and method:

```java
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import com.towin.common.service.TrustScoreService;
```

Update the class to inject `TrustScoreService` (add alongside existing `TrustService` field):

```java
private final TrustScoreService trustScoreService;
```

Add the new endpoint method inside `TrustController`:

```java
@GetMapping("/my-score")
public ResponseEntity<TrustScoreBreakdownResponse> getMyScore(Authentication auth) {
    UUID userId = UUID.fromString(auth.getName());
    return ResponseEntity.ok(trustScoreService.getMyScoreBreakdown(userId));
}
```

- [ ] **Step 2: Compile to verify**

```bash
cd backend && ./mvnw compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 3: Smoke-test the endpoint manually**

Start the backend if not running: `cd backend && ./mvnw spring-boot:run -q &`

Then (replace TOKEN with a real JWT from login):
```bash
curl -s -H "Authorization: Bearer TOKEN" http://localhost:8080/api/trust/my-score | python3 -m json.tool
```
Expected: JSON with `totalScore`, `tier`, `criteria` array of 7 objects.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/towin/trust/controller/TrustController.java
git commit -m "feat(trust): expose GET /api/trust/my-score endpoint"
```

---

## Chunk 2: Frontend — Trust Page + NavBar Tab

### Task 4: Create `Trust.jsx` page

**Files:**
- Create: `frontend/src/pages/Trust.jsx`

Match the existing design system exactly:
- Font: `-apple-system, 'SF Pro Display'/'SF Pro Text', system-ui, sans-serif`
- Palette: `#4FA3CE` (blue), `#7BC893` (green), `#1d1d1f` (text), `#fafafc` (page bg), `#ffffff` (cards), `#ececef` (borders)
- Cards: `borderRadius: 18px`, `border: 1px solid #e0e0e0`, `padding: 28px 32px`
- Pill badges: `borderRadius: 9999px`

- [ ] **Step 1: Create the page**

```jsx
import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import api from '../api/axios';

const SF  = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;

const TIER_COLORS = {
  'Community Champion': { bg: '#FFF7E6', color: '#92400e', border: '#FDE68A' },
  'Highly Trusted':    { bg: '#EBF6EE', color: '#3D8B5A', border: '#A7D9B5' },
  'Reliable':          { bg: '#EAF5FB', color: '#3D8AB0', border: '#A8D4EC' },
  'Getting Started':   { bg: '#F3F4F6', color: '#5a6470', border: '#D1D5DB' },
  'New Member':        { bg: '#F3F4F6', color: '#9ca3af', border: '#E5E7EB' },
};

const KEY_COLORS = {
  phone_verified:      '#4FA3CE',
  id_verified:         '#7BC893',
  trusted_connections: '#4FA3CE',
  completed_services:  '#7BC893',
  avg_rating:          '#4FA3CE',
  account_age:         '#7BC893',
  reports:             '#dc2626',
};

function ScoreRing({ score, max }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const filled = (score / max) * circ;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#ececef" strokeWidth="10" />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke="#4FA3CE" strokeWidth="10"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="70" y="65" textAnchor="middle"
        style={{ fontFamily: SFD, fontSize: '28px', fontWeight: 700, fill: '#1d1d1f' }}>
        {score}
      </text>
      <text x="70" y="85" textAnchor="middle"
        style={{ fontFamily: SF, fontSize: '12px', fill: '#7a7a7a' }}>
        out of {max}
      </text>
    </svg>
  );
}

function CriterionRow({ criterion }) {
  const { label, earned, max, detail, positive, key } = criterion;
  const barColor = KEY_COLORS[key] ?? '#4FA3CE';
  const pct = max > 0 ? Math.max(0, Math.min(100, (earned / max) * 100)) : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 200px 80px',
      alignItems: 'center',
      gap: '20px',
      padding: '14px 0',
      borderBottom: '1px solid #f0f0f2',
    }}>
      {/* Label + detail */}
      <div>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1d1d1f', fontFamily: SF }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#7a7a7a', fontFamily: SF }}>{detail}</p>
      </div>

      {/* Progress bar */}
      <div>
        {positive && max > 0 ? (
          <div style={{ height: '6px', borderRadius: '9999px', background: '#ececef', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: barColor, borderRadius: '9999px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        ) : (
          <div style={{ height: '6px' }} />
        )}
      </div>

      {/* Points */}
      <div style={{ textAlign: 'right' }}>
        <span style={{
          fontSize: '15px', fontWeight: 700,
          color: !positive && earned < 0 ? '#dc2626' : '#1d1d1f',
          fontFamily: SFD,
        }}>
          {earned > 0 ? `+${earned}` : earned}
        </span>
        {max > 0 && (
          <span style={{ fontSize: '12px', color: '#a0a0a5', fontFamily: SF }}> / {max}</span>
        )}
      </div>
    </div>
  );
}

export default function Trust() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/trust/my-score')
      .then(r => setData(r.data))
      .catch(() => setError('Could not load your trust score. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const tierStyle = data ? (TIER_COLORS[data.tier] ?? TIER_COLORS['New Member']) : null;

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc' }}>
      <NavBar />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontFamily: SFD, fontSize: '34px', fontWeight: 700,
            color: '#1d1d1f', margin: '0 0 8px', letterSpacing: '-0.4px',
          }}>
            Your Trust Score
          </h1>
          <p style={{ fontFamily: SF, fontSize: '16px', color: '#7a7a7a', margin: 0 }}>
            This score reflects how the community sees you — earn points by verifying your identity, building connections, and helping others.
          </p>
        </div>

        {loading && (
          <div style={{
            background: '#ffffff', borderRadius: '18px', border: '1px solid #e0e0e0',
            padding: '60px', textAlign: 'center',
            fontFamily: SF, fontSize: '15px', color: '#7a7a7a',
          }}>
            Loading your score…
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: '14px', padding: '16px 20px',
            fontFamily: SF, fontSize: '14px', color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Score card */}
            <div style={{
              background: '#ffffff', borderRadius: '18px',
              border: '1px solid #e0e0e0', padding: '32px',
              display: 'flex', alignItems: 'center', gap: '40px',
              marginBottom: '24px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <ScoreRing score={data.totalScore} max={data.maxScore} />

              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: tierStyle.bg, color: tierStyle.color,
                  border: `1px solid ${tierStyle.border}`,
                  borderRadius: '9999px', padding: '5px 16px',
                  fontSize: '13px', fontWeight: 700, fontFamily: SF,
                  letterSpacing: '0.2px', marginBottom: '12px',
                }}>
                  {data.tier}
                </div>

                <h2 style={{
                  fontFamily: SFD, fontSize: '22px', fontWeight: 700,
                  color: '#1d1d1f', margin: '0 0 6px', letterSpacing: '-0.3px',
                }}>
                  {data.totalScore} / {data.maxScore} points
                </h2>
                <p style={{ fontFamily: SF, fontSize: '14px', color: '#7a7a7a', margin: 0, lineHeight: 1.5 }}>
                  {data.totalScore < 30
                    ? 'Verify your phone and ID to unlock a big score boost.'
                    : data.totalScore < 60
                    ? 'Keep building connections and completing help requests.'
                    : 'Great score — keep building trust with the community!'}
                </p>
              </div>
            </div>

            {/* Breakdown card */}
            <div style={{
              background: '#ffffff', borderRadius: '18px',
              border: '1px solid #e0e0e0', padding: '28px 32px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <h3 style={{
                fontFamily: SFD, fontSize: '17px', fontWeight: 700,
                color: '#1d1d1f', margin: '0 0 4px', letterSpacing: '-0.2px',
              }}>
                Score Breakdown
              </h3>
              <p style={{ fontFamily: SF, fontSize: '13px', color: '#a0a0a5', margin: '0 0 16px' }}>
                How each criterion contributes to your total
              </p>

              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 200px 80px',
                gap: '20px', paddingBottom: '8px',
                borderBottom: '1px solid #ececef',
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a0a0a5', letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: SF }}>Criterion</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a0a0a5', letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: SF }}>Progress</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a0a0a5', letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: SF, textAlign: 'right' }}>Points</span>
              </div>

              {data.criteria.map(c => (
                <CriterionRow key={c.key} criterion={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no syntax errors (Vite dev server should hot-reload without errors)**

Check the browser console at `http://localhost:5173` — no red errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Trust.jsx
git commit -m "feat(trust): add Trust score breakdown page"
```

---

### Task 5: Register `/trust` route in `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add import and route**

Add import near the top with other page imports:
```jsx
import Trust from './pages/Trust';
```

Add route inside `<Routes>` after the `/messages/:connectionId` route:
```jsx
<Route path="/trust" element={<PrivateRoute><Trust /></PrivateRoute>} />
```

- [ ] **Step 2: Verify hot reload — navigate to `http://localhost:5173/trust`**

Expected: Trust page renders (even if score is loading).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(trust): register /trust route in App"
```

---

### Task 6: Add "Trust" tab to NavBar

**Files:**
- Modify: `frontend/src/components/NavBar.jsx`

- [ ] **Step 1: Add the NavLink**

In `NavBar.jsx`, inside the `<div>` that holds the nav links (after the `Profile` link and before the Emergency link):

```jsx
<NavLink to="/trust" label="Trust" />
```

The full nav links block should look like:
```jsx
<NavLink to="/dashboard" label="Dashboard" />
<NavLink to="/messages" label="Messages" />
<NavLink to="/profile" label="Profile" />
<NavLink to="/trust" label="Trust" />
{isElder && <NavLink to="/emergency-contacts" label="Emergency" />}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/dashboard` — "Trust" tab appears in the nav. Click it — Trust page loads with the score breakdown.

- [ ] **Step 3: Test all three roles**

Log in as an ELDER, HELPER, and BOTH user — all should see the Trust tab and their own breakdown.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NavBar.jsx
git commit -m "feat(trust): add Trust tab to NavBar"
```

---

## Done Checklist

- [ ] `GET /api/trust/my-score` returns 7-criterion breakdown JSON for any authenticated user
- [ ] `TrustScoreServiceTest` — 5 tests, all green
- [ ] Trust page shows score ring, tier badge, breakdown table
- [ ] Progress bars animate correctly for each criterion
- [ ] Penalty row (reports) shown in red with negative value
- [ ] All three roles (ELDER, HELPER, BOTH) can access `/trust`
- [ ] "Trust" tab highlighted when on `/trust` route
- [ ] No regressions on existing nav links or pages
