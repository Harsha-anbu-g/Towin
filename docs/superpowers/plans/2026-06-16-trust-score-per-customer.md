# Trust Score v3 — Per-Customer Model

**Date:** 2026-06-16
**Goal:** Make the trust score simple and easy to understand. A user should see, for **every customer they help**, exactly what they earned, and how it adds to their trust score.

## The model (confirmed with user)

Every customer relationship is worth **up to 15 points**:

| Part        | Points | Rule |
|-------------|--------|------|
| **Rooting** | 0–7    | The trust journey has 7 stages. Each stage you reach with that customer = **1 point** (Connected, Messaging, Phone, Video, Verified, Met in person, Fully Trusted). |
| **Review**  | 0–5    | When the customer reviews you, you earn **1 point per star** (max 5). |
| **Profile** | 0–3    | Your profile completeness. Counts **for every customer** — a complete profile silently adds 3 to each one. |

**Total trust score = sum across all customers.** All numbers are whole integers (no more 0.25 / 6.25).

Profile is the same value for every customer (it mirrors your current profile), so a full profile = 3 × (number of customers). This is intentional: it strongly rewards setting up a profile.

### Profile = 3 simple milestones (1 point each)
Replaces the old 8-field × 0.25 system so the number stays a clean integer:
1. **Add a profile photo** → 1
2. **Write a short bio** → 1
3. **Verify yourself** (phone or ID) → 1

### Rooting stage → points
`points = min(trustLevel.value + 1, 7)` — DISCOVERED=1 … TRUSTED=7.

### Tiers (rebased for the new scale; ~12 per completed customer)
- New Member: 0
- Getting Started: 1–14
- Reliable: 15–44   (~1–3 customers)
- Highly Trusted: 45–89
- Community Champion: 90+   (~6 fully completed customers)

## Backend changes
1. **TrustScoreService** — rewrite `recalculate` + `getMyScoreBreakdown` to the per-customer model; add helpers `rootingPoints`, `calculateProfilePoints`, `latestRatingByReviewer`, `stageLabel`, `displayName`, `photoUrl`; rebase `tierFor`.
2. **TrustScoreBreakdownResponse** — new shape: `{ totalScore, tier, maxPerCustomer, profile{earned,max,tasks[]}, customers[] }` where each customer card has rooting/review/profile/total + stage label + name/photo.
3. **TrustService.confirmTrustLevel** — recalc both users on **every** advancement (not only TRUSTED).
4. **ConnectionService.respond** — recalc both users when a connection becomes ACTIVE (so the first "Connected" point registers in the stored score).
5. **Tests** — rewrite `TrustScoreServiceTest` for the new structure.

## Frontend changes (Trust.jsx only — one screen; brand colors locked)
- Header: total score ring + rebased tier.
- **Your profile** card: 3 milestones, "adds 3 pts to every customer."
- **Your customers** section: one card per active relationship showing current stage, Rooting x/7 (stage pips), Review x/5 (stars), Profile 3/3, and the per-customer total **/15**.
- Empty state when no customers yet.
- Update tier thresholds text in `guideContent.jsx`.

## Verification
- `mvn -q test` (backend) green.
- `npm run build` (frontend) green.
- Then merge to main and push.
