# Browse Needs — posted-time + Available/Applied/Completed sub-tabs

Date: 2026-06-30
Status: Approved
Area: Helper dashboard → Browse Needs tab

## Problem

In the helper's **Browse Needs** tab (`HelperDashboard.jsx`, `tab === 'browse'`):

1. Request cards show no indication of **when the elder posted** the request, so a
   helper can't tell a fresh request from a stale one.
2. The tab is a single flat list of open requests. "Applied" state lives only in
   ephemeral component state (`applyMsg`) and is **lost on refresh**. There is no
   way for a helper to see the requests they've applied to, or ones they've
   completed.

## Goals

- Show a plain-language **"Posted … ago"** timestamp on every request card
  (e.g. "just now", "1 hour ago", "2 days ago", "3 weeks ago").
- Split Browse Needs into three sub-tabs: **Available · Applied · Completed**,
  persisted so a refresh keeps the helper's place and their application history.

## Non-goals

- No change to the elder's side of needs, or to how elders accept/complete.
- No new "in progress" tab (folded into Applied). Keep exactly three sub-tabs.
- No push notifications or realtime updates for application state.

## Segment semantics (helper's viewpoint)

| Sub-tab | Contents | Card action |
|---|---|---|
| **Available** | OPEN needs nearby the helper has **not** applied to (`myApplicationStatus == null`) | "Offer to Help" |
| **Applied** | Needs the helper applied to that are still live: app `PENDING` (need `OPEN`) → "Waiting to hear back"; app `ACCEPTED` (need `ASSIGNED`) → "You're helping" | Withdraw (only while PENDING) |
| **Completed** | Needs the helper was accepted for and are now `COMPLETED` | none — "Completed" pill |

Rejected (`REJECTED`) and withdrawn (`WITHDRAWN`) applications drop off all three
buckets, keeping them clean. Each segment shows a friendly `SegmentEmpty` state
when it has no cards.

## Design

### Part A — "Posted … ago" (frontend only)

`NeedResponse.createdAt` (LocalDateTime) is already returned by the API. Add a
`postedAgo(iso)` helper to `HelperDashboard.jsx` returning long-form, everyday
wording:

- < 1 min → "just now"
- < 1 hour → "N minutes ago" / "1 minute ago"
- < 1 day → "N hours ago" / "1 hour ago"
- < 7 days → "N days ago" / "1 day ago"
- < ~5 weeks → "N weeks ago" / "1 week ago"
- else → "N months ago" / "1 month ago"

Render as a muted line (`#8a929c`) in each card's meta row, near the
distance / "Posted by" text. Applies to cards in all three segments.

### Part B — Available/Applied/Completed (full-stack)

Persistence requires knowing, per helper, which needs they applied to and the
outcome. A client-only approach was rejected: Applied/Completed would be empty
after any refresh and could never show completed history.

**Backend**

1. `NeedResponse`: add `private ApplicationStatus myApplicationStatus;` (nullable)
   — the current viewer's own application state for that need.
2. `NeedApplicationRepository`: add
   `List<NeedApplication> findByHelperId(UUID helperId);`
3. `NeedService`:
   - Overload `toResponse` to accept the viewer's application status and set
     `myApplicationStatus`.
   - `getAllOpen` / `browseNearby`: batch-load the helper's applications once into
     a `Map<UUID needId, ApplicationStatus>` and set `myApplicationStatus` on each
     response — so "already applied" survives a refresh.
   - New `getMyApplications(UUID helperId)`: return needs the helper has a
     non-`WITHDRAWN` application for, each carrying `myApplicationStatus` and the
     need's own `status`, newest application first.
4. `NeedController`: add `GET /api/needs/applications` →
   `needService.getMyApplications(userId)`.

**Frontend (`HelperDashboard.jsx`)**

1. New URL sub-segment param `bseg` (`available` | `applied` | `completed`),
   default `available`, mirroring the existing `eseg` pattern for My Elders.
2. New state `myApplications`; `loadMyApplications()` calls
   `GET /needs/applications`. In the `tab === 'browse'` effect, load both
   `loadNeeds()` and `loadMyApplications()`.
3. Render `<SegmentedTabs>` with the three segments (+ counts) under the Browse
   header, above the list.
4. Segment content:
   - **Available**: `needs` filtered to `myApplicationStatus == null`.
   - **Applied**: `myApplications` where need `status ∈ {OPEN, ASSIGNED}` and app
     `status ∈ {PENDING, ACCEPTED}`; status pill + Withdraw (PENDING only).
   - **Completed**: `myApplications` where need `status === COMPLETED`.
5. The "already applied" checkmark now derives from backend `myApplicationStatus`
   instead of ephemeral `applyMsg` (keep `applyMsg` only for transient
   optimistic/error text). After `apply()` / `withdrawApplication()`, reload both
   `needs` and `myApplications`.
6. Every card shows the `postedAgo(need.createdAt)` line.

## Testing

- **Backend** (`NeedServiceTest`): `getMyApplications` returns the helper's
  applied/completed needs with `myApplicationStatus` set; browse responses carry
  `myApplicationStatus` for already-applied needs and `null` otherwise.
- **Frontend**: dev-server / Playwright smoke — switch sub-tabs, confirm posted-ago
  text, confirm Applied persists across reload.

## Files touched

- `backend/.../need/dto/NeedResponse.java`
- `backend/.../need/repository/NeedApplicationRepository.java`
- `backend/.../need/service/NeedService.java`
- `backend/.../need/controller/NeedController.java`
- `backend/.../need/service/NeedServiceTest.java` (tests)
- `frontend/src/pages/HelperDashboard.jsx`
