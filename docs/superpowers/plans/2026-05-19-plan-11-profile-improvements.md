# Profile Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four UX improvements — new profile fields, star rating UI, trust score card on dashboard, and role-restricted Trust nav link.

**Architecture:** All frontend-only or paired frontend/backend changes. No new DB migrations needed. Each task is independent.

**Tech Stack:** Spring Boot 3 / JPA · React 18 / React Router v6 / inline styles · Sky-blue palette (#4FA3CE, #3D8AB0, #EAF5FB, #BFD9EA) · SF Pro fonts

---

## Pre-flight: Already Done

Before writing any code, a file audit confirmed three of the four tasks are already implemented:

| Task | Status | Evidence |
|------|--------|----------|
| ProfileEdit new fields (hobbies, occupation, social, DOB) | ✅ Already done | `frontend/src/pages/ProfileEdit.jsx:56–180` — form state, load, and save all include the new fields |
| 5-star picker in review form | ✅ Already done | `frontend/src/pages/HelperDashboard.jsx:14–36` — `StarPicker` component already renders 1–5 stars; `ReviewRequest.java` already has `@Min(1) @Max(5)` |
| Trust Score card on Helper Dashboard Overview | ✅ Already done | `frontend/src/pages/HelperDashboard.jsx:296–320` — card with trustScore + trustTier + navigate('/trust') already exists |
| NavBar Trust link restricted to HELPER/BOTH | ❌ Not done | `frontend/src/components/NavBar.jsx:86` — `<NavLink to="/trust" label="Trust" />` shows to all roles |

---

## Task 1: Restrict Trust nav link to HELPER/BOTH roles

**Files:**
- Modify: `frontend/src/components/NavBar.jsx:15–88`

- [ ] **Step 1: Add `isHelper` constant below `isElder`**

At line 15 of `NavBar.jsx`, after:
```js
const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';
```
Add:
```js
const isHelper = user?.role === 'HELPER' || user?.role === 'BOTH';
```

- [ ] **Step 2: Wrap the Trust NavLink with `isHelper`**

Change line 86 from:
```jsx
<NavLink to="/trust" label="Trust" />
```
To:
```jsx
{isHelper && <NavLink to="/trust" label="Trust" />}
```

- [ ] **Step 3: Verify manually**

Start the frontend dev server. Log in as an ELDER — confirm "Trust" does not appear in the nav. Log in as a HELPER — confirm "Trust" appears and links to `/trust`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NavBar.jsx
git commit -m "feat: restrict Trust nav link to HELPER and BOTH roles"
```
