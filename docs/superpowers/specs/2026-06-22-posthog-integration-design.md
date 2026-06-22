# PostHog Integration — Design Spec

**Date:** 2026-06-22
**Status:** Approved (design)
**Scope:** Product analytics across the React (Vite) frontend and Spring Boot backend.

## Goal

Add PostHog product analytics to ToWin:

- Track all users (no opt-in consent gate).
- Session replay **on** (with input masking for privacy).
- A small **one-time** informational banner letting users know analytics + recording are in use — it does **not** block the app and is **not** a permission form.
- Both **frontend** (browser behaviour) and **backend** (server-side events) send to PostHog.

All data (events + replays) is stored on **PostHog Cloud servers**, not ToWin servers. Expected cost: **$0** at current scale (free tier ≈ 1M events/month + ≈ 5k recordings/month).

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Consent model | Always track; one-time info banner; no Accept/Decline. |
| Session replay | **On.** `mask_all_inputs: true` so typed content (messages, emails, passwords) is not recorded; clicks, scrolls, navigation still captured. |
| Scope | Frontend **and** backend. |
| Hosting | PostHog Cloud (not self-hosted). |
| distinct_id | The user's id (JWT `sub`) on both frontend and backend, so events merge into one person's timeline. |

> ⚠️ **Known risk (accepted by owner):** always-track + session recording without opt-in is not GDPR-compliant for EU/elderly users. Built this way per explicit decision.

## Frontend (React + Vite)

### 1. Dependency & init
- `npm install posthog-js` in `frontend/`.
- Wrap the app in `PostHogProvider` in `frontend/src/main.jsx`:
  - `apiKey` = `import.meta.env.VITE_PUBLIC_POSTHOG_KEY`
  - `options.api_host` = `import.meta.env.VITE_PUBLIC_POSTHOG_HOST`
  - `options.defaults = '2025-05-24'` → automatic SPA pageviews on React Router navigation + autocapture of clicks/forms.
  - Session replay enabled with `session_recording: { maskAllInputs: true }` (and PostHog's default password masking).
- **Guard:** if `VITE_PUBLIC_POSTHOG_KEY` is absent (e.g. local dev), render children without the provider so the app still runs and no events are sent.

### 2. User identity — `frontend/src/context/AuthContext.jsx`
- On `login(token)`: `posthog.identify(userId, { role })`.
- On `logout()`: `posthog.reset()`.
- Use the `posthog-js` singleton import inside the context (it is safe to call when uninitialized).

### 3. Info banner — `frontend/src/components/CookieConsent.jsx`
- Reword copy to mention analytics + session recording and link the Privacy Policy.
- Keep existing **show-once** behaviour (localStorage key `cookieConsent`) and the non-blocking single "Got it" button.
- Tracking is **not** gated on the banner.

## Backend (Spring Boot, Maven, `com.towin.*`)

### 4. Dependency & client config
- Add `com.posthog.java:posthog` to `backend/pom.xml`.
- New `com.towin.common.config.PostHogConfig`:
  - Reads a new `posthog:` namespace from `application.yml` (`api-key`, `host`).
  - Builds and exposes a PostHog client bean.
  - **No-op when `api-key` is blank** (same defensive pattern as Twilio/AWS config) so local/CI runs are unaffected.

### 5. Service wrapper — `com.towin.common.service.PostHogService`
- Thin wrapper: `capture(String distinctId, String event, Map<String,Object> properties)`.
- Safe to call even when PostHog is unconfigured (silently does nothing).
- Flush/shutdown the client on application shutdown (`@PreDestroy`).

### 6. Initial server-side events — `AuthService`
- `user_signed_up` — on successful signup.
- `email_verified` — when a user verifies their email.
- `distinct_id` = the user's id (matches the frontend), so frontend + backend events merge.
- Designed to be easily extended (e.g. `connection_requested`, `connection_accepted`) later.

## Config / secrets

- `frontend/.env.example`: add `VITE_PUBLIC_POSTHOG_KEY=` and `VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`.
- `backend/src/main/resources/application.yml`: add
  ```yaml
  posthog:
    api-key: ${POSTHOG_API_KEY:}
    host: ${POSTHOG_HOST:https://us.i.posthog.com}
  ```
- Real keys live in Railway env vars (backend) and the frontend build environment. **Never committed.** The frontend project API key (`phc_...`) is public-safe; the same key is used by the backend.

## Out of scope (for now)

- Feature flags / A/B testing.
- Backend events beyond signup + email verification.
- An Accept/Decline consent flow (explicitly declined by owner).

## Verification

- Frontend: with a key set, a pageview + autocaptured click appears in PostHog Live Events; logging in shows an `identify`; a session recording appears.
- Frontend: with **no** key set, app runs normally and no network calls go to PostHog.
- Backend: with a key set, signing up and verifying email produce `user_signed_up` and `email_verified` events under the same person as the frontend events.
- Backend: with **no** key set, app boots and all flows work; no PostHog calls made.
