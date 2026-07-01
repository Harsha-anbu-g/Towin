# Plan: A dedicated "Requests" page in the Helper dashboard

Status: **Implemented** (2026-06-30) — `frontend/src/pages/HelperDashboard.jsx`

## Context
A helper's connection requests used to be buried as a **sub-segment** ("Requests")
inside the **My Elders** tab. To find people who wanted to connect, a helper had
to open My Elders, then switch to the Requests segment. The ask: the familiar
pattern from other apps — **one dedicated page where every pending connection
request lives** — so a helper goes straight there and accepts to get connected.

The request cards already existed; this promoted them to their own top-level tab
and tidied up My Elders. No backend, no new components.

## What changed (all in `HelperDashboard.jsx`)

### 1. New `requests` top-level tab
- Added `['requests', 'Requests', requestsBadge]` to the `tabs` array.
- Added a `requests` case to `TabIcon` (an inbox SVG).
- Named **"Requests"**, not "My Requests" — "My Requests" already means posted
  help-needs on the Elder side (`ElderDashboard.jsx`), so reusing it would collide.

### 2. Request buckets + badge
- `incomingRequests = connections.filter(c => c.status === 'PENDING' && !c.initiatedByMe)`
- `sentRequests     = connections.filter(c => c.status === 'PENDING' && c.initiatedByMe)`
- `requestsBadge = incomingRequests.length` — friend-request-style count of what
  needs action. Clears automatically because `respondToConnection` reloads.

### 3. `renderPendingCard(conn, i)` helper + the `tab === 'requests'` section
Extracted the pending-card markup (incoming = "wants to connect with you" +
Accept/Decline; sent = "Request Sent" pill) into one reusable renderer. The
Requests page shows **New Invites** then **Requests You Sent**, with section
labels only when both are present, and a single friendly empty state otherwise.

### 4. Trimmed My Elders
- Removed the `requests` entry from `elderSegments` → My Elders now shows only
  **Active** + **Building Trust**.
- `visibleConnections` filters to ACTIVE only; the connection card was
  simplified to the active-only path (no more `isIncoming` / "Request Sent"
  branches — those live solely in `renderPendingCard` now).
- Rescoped the My Elders badge (`connTokens`) to ACTIVE connections, so a pending
  request badges the Requests tab instead of My Elders.

## Out of scope
- Elder dashboard (one screen at a time). No backend / API / color changes.

## Verification
- `npx esbuild src/pages/HelperDashboard.jsx` → compiles clean.
- `npx eslint src/pages/HelperDashboard.jsx` → no new errors (only pre-existing).
- Browser walkthrough with the demo helper (`helper@gmail.com`) — the seeded
  incoming request from Grace should appear under Requests → New Invites with a
  badge of 1; My Elders should show only Active + Building Trust. (Deferred:
  local Playwright browser was locked by another session at implementation time.)
