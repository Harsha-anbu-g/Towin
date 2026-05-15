# Plan 5 — Reviews & Trust Score + Reports

**Date:** 2026-05-10
**Branch:** plan-5/reviews-trust-reports
**Status:** Complete (with full trust score engine added in redo pass)

## Tasks

- [x] Task 1: V10 (reviews) + V11 (reports) + V12 (phone_verified) migrations
- [x] Task 2: Review entity + repository, Report entity + repository
- [x] Task 3: ReviewService + ReviewController (incl. GET /reviews/given)
- [x] Task 4: ReportService + ReportController
- [x] Task 5: TrustScoreService — full spec formula, safety triggers, auto-suspend
- [x] Task 6: Wire TrustScoreService into ReviewService, ReportService, NeedService, TrustService
- [x] Task 7: Graduated trust start level in ConnectionService
- [x] Task 8: trustScore + trustTier in ProfileResponse; TrustBadge component
- [x] Task 9: Frontend — Leave Review inline form on COMPLETED needs (ElderDashboard)
- [x] Task 10: Frontend — Helper can review Elder on TRUSTED connections (HelperDashboard)
- [x] Task 11: Frontend — Reviews Received section (ProfileEdit) with trust badge
- [x] Task 12: Frontend — Report button + panel (Messages)
- [x] Task 13: TrustBadge shown on profile headers + discovery cards + connection cards
- [x] Task 14: Commit, push, update Notion + Graphify

## New Endpoints

- POST /api/reviews — submit review (reviewer = auth user)
- GET  /api/reviews/mine — reviews I've received
- GET  /api/reviews/given — reviews I've submitted
- GET  /api/reviews/user/{userId} — reviews received by a specific user
- POST /api/reports — submit a safety/behaviour report

## DB Migrations

### V10 — reviews
```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    reviewee_id UUID NOT NULL REFERENCES users(id),
    need_id UUID REFERENCES needs(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    tags TEXT[],
    comment TEXT,
    safety_concern BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### V11 — reports
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reported_user_id UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### V12 — phone_verified column
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
```

## Trust Score Formula (spec-accurate)

Recalculated from scratch by `TrustScoreService.recalculate(userId)`:

| Factor | Points |
|--------|--------|
| Phone verified | +10 |
| ID verified (verificationStatus = VERIFIED) | +20 |
| Each TRUSTED connection (Level 6) | +5, max +25 |
| Each completed service as helper | +3, max +15 |
| Avg review rating mapped 0–10: (avg-1)/4×10 | 0–10 |
| Account active > 30 days | +5 |
| Each report received | -15 |
| Clamped | 0–100 |

**Safety triggers (in recalculate):**
- score < 20 → user.isActive = false
- safetyConcern reviews received ≥ 3 → user.isActive = false

**Graduated trust start level (ConnectionService.sendRequest):**
- score 0–50 → DISCOVERED
- score 51–70 → PHONE_CALL
- score 71+ → VERIFIED

## Score Tiers (TrustScoreService.tierFor)

| Score | Tier |
|-------|------|
| 0–30 | New Member |
| 31–50 | Getting Started |
| 51–70 | Reliable |
| 71–90 | Highly Trusted |
| 91–100 | Community Champion |

## Key Decisions

- `TrustScoreService` lives in `common/service/` to avoid circular dependencies
- Reviewer anonymized to "Anonymous" when `safetyConcern = true` in ReviewResponse
- Duplicate review guard: `existsByNeedIdAndReviewerId` prevents multiple reviews per need per reviewer
- No admin UI for reports — stored as OPEN, reviewed manually for MVP
- `TrustBadge` is a pure stateless component; tier colour is looked up from a static map
- Helper can review Elder only when connection has reached `TRUSTED` level
