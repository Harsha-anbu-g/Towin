# Plan: One "Add Friends" hub + unified "Help" vocabulary

Status: **Helper dashboard done** (2026-07-01). Elder dashboard pending user review.

## Context
The app has one underlying relationship but named the same ideas many overlapping
ways ("Connect / Request / Invite / Need"), and connecting was scattered across
tabs. Behavior is unchanged — this standardizes the words (Instagram/Facebook
"friend request"; care apps "help") and gathers all connecting into one tab. Done
one screen at a time: Helper first, then Elder.

## Locked vocabulary — two families that never overlap
- **Connecting → "friend request":** **Add Friend** (button) → **Requested**
  (grey, disabled) → incoming = **New Invites** (Accept/Decline) → accepted stay
  **My Elders / My Helpers**.
- **Asking → "Help":** elder **Post Help** → list **My Help**; helper browses
  **Help Nearby** → **Offer to Help**. "Need" and task-sense "Request" retired.

## Target structure — 3 tabs each, symmetric
```
Helper:  My Elders   ·  Add Friends  ·  Help Nearby
Elder:   My Helpers  ·  Add Friends  ·  My Help
```
**Add Friends** tab = one hub via `SegmentedTabs`:
1. **New Invites** — people who sent you a request → Accept / Decline
2. **Requested** — requests you sent, still pending → grey **Requested**
3. **Find New Elders / Find New Helpers** — discover people, tap **Add Friend**

## Screen 1 — Helper (`frontend/src/pages/HelperDashboard.jsx`) — DONE
- Tabs → `My Elders · Add Friends · Help Nearby` (dropped the separate discover
  tab; folded into Add Friends via `friendsSeg` = invites | requested | find).
- Add Friends: SegmentedTabs; New Invites (reuse `renderPendingCard`), Requested
  (grey pill), Find New Elders (the old discover block, re-guarded to
  `tab==='requests' && friendsSeg==='find'`).
- Discover card: **Connect → Add Friend**; success → grey **Requested**
  (`connectMsg` set to `'Requested'`, plus `requestedElderIds` from `sentRequests`
  so it persists across reloads); already-connected → **Friends**; API error shown
  grey inline.
- Help Nearby: heading "Requests Near You" → **Help Nearby**; radius noun and
  empty-state "requests" → "help"; **Offer to Help** kept.
- renderPendingCard: "New Request" → **New Invite**, "wants to connect with you" →
  **sent you a friend request**, "Request Sent" → **Requested**.
- Verified: esbuild clean, eslint no new errors, browser walkthrough as demo
  helper (New Invite from Grace, Find New Elders list, Help Nearby all correct).

## Screen 2 — Elder (`frontend/src/pages/ElderDashboard.jsx`) — PENDING
- Tabs → `My Helpers · Add Friends · My Help`.
- Move the "New Invites" segment out of My Helpers into a new **Add Friends** tab
  = SegmentedTabs [New Invites | Requested | Find New Helpers] (fold in discover).
- My Help = current "My Requests": segment "Pending Request" → **Looking for
  Help**; "Post a Request / Post My Request" → **Post Help**; toast → **Help posted!**.
- Discover Connect → **Add Friend**, sent → grey **Requested**.

## Elsewhere
- NavBar already "Post New Help". Landing copy = later pass.

## Constraints
- Brand colors locked; only new color = neutral grey of the disabled "Requested".
- User-facing strings only; internal identifiers unchanged.
