# PostHog Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostHog product analytics (events + session replay) to the ToWin React frontend and Spring Boot backend, tracking all users with a one-time informational banner and no consent gate.

**Architecture:** Frontend uses the `posthog-js` `PostHogProvider` (autocapture pageviews/clicks + session replay with masked inputs) and identifies the logged-in user. Backend uses the `posthog-java` client wrapped in a single self-contained `PostHogService` that is a **no-op when no API key is configured** (so local/CI runs are unaffected), capturing `user_signed_up` and `email_verified`. Frontend and backend use the **same user id as `distinct_id`** so events merge into one person's timeline.

**Tech Stack:** React 19 + Vite, `posthog-js`; Spring Boot 3.5.15 / Java 21 (Maven), `com.posthog.java:posthog:1.2.0`.

**Spec:** `docs/superpowers/specs/2026-06-22-posthog-integration-design.md`

---

## Notes for the implementer

- **Backend has a test harness** (JUnit 5 + Mockito + AssertJ) → backend tasks are TDD. Run tests with `./mvnw` from `backend/` (Maven wrapper is present; `mvn` works too).
- **Frontend has NO test harness** (no `test` script in `package.json`) → frontend tasks use **manual verification** against the running dev server + PostHog "Activity → Live events" dashboard. Do not add a test framework (YAGNI).
- **Refinement vs spec:** the spec mentioned a separate `PostHogConfig` + `PostHogService`. This plan folds both into a single self-contained `PostHogService` (client built in its constructor, package-private constructor for test injection). Same behaviour, fewer moving parts. This is the only deliberate deviation.
- The frontend project API key (`phc_...`) is public-safe; the **same key** is reused by the backend.
- Real keys are never committed — they go in Railway env vars (backend) and the frontend build env.

## File Structure

**Backend (create):**
- `backend/src/main/java/com/towin/common/service/PostHogService.java` — the client wrapper; no-op when unconfigured; `@PreDestroy` flush.
- `backend/src/test/java/com/towin/common/service/PostHogServiceTest.java` — unit tests for the wrapper.

**Backend (modify):**
- `backend/pom.xml` — add `posthog` dependency.
- `backend/src/main/resources/application.yml` — add `posthog:` config block.
- `backend/src/main/java/com/towin/auth/service/AuthService.java` — inject `PostHogService`; capture `user_signed_up` (in `register`) and `email_verified` (in `verifyEmail`).
- `backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java` — add `@Mock PostHogService`; assert `email_verified` captured.
- `backend/src/test/java/com/towin/auth/service/AuthServiceTest.java` — add `@Mock PostHogService` (prevents NPE now that AuthService has a new dependency).

**Frontend (create):** none.

**Frontend (modify):**
- `frontend/package.json` / lockfile — add `posthog-js`.
- `frontend/.env.example` — add the two `VITE_PUBLIC_POSTHOG_*` vars.
- `frontend/src/main.jsx` — wrap app in `PostHogProvider` (guarded when no key).
- `frontend/src/context/AuthContext.jsx` — `posthog.identify` on login, `posthog.reset` on logout.
- `frontend/src/components/CookieConsent.jsx` — reword to mention analytics + session recording (keep show-once + non-blocking).

---

## Chunk 1: Backend — PostHog client wrapper

### Task 1: Add dependency and config

**Files:**
- Modify: `backend/pom.xml` (after the Twilio dependency block, ~line 141)
- Modify: `backend/src/main/resources/application.yml` (after the `twilio:` block, ~line 91)

- [ ] **Step 1: Add the Maven dependency**

In `backend/pom.xml`, after the Twilio `</dependency>` (the block ending at line 141), add:

```xml
        <!-- PostHog product analytics -->
        <dependency>
            <groupId>com.posthog.java</groupId>
            <artifactId>posthog</artifactId>
            <version>1.2.0</version>
        </dependency>
```

- [ ] **Step 2: Add the config block**

In `backend/src/main/resources/application.yml`, after the `twilio:` block (lines 88-91), add a top-level block:

```yaml
posthog:
  api-key: ${POSTHOG_API_KEY:}
  host: ${POSTHOG_HOST:https://us.i.posthog.com}
```

- [ ] **Step 3: Verify the dependency resolves**

Run from `backend/`: `./mvnw -q dependency:resolve -Dsilent=true | grep -i posthog || ./mvnw -q -o validate`
Expected: build succeeds; PostHog 1.2.0 is downloaded (no resolution error).

- [ ] **Step 4: Commit**

```bash
git add backend/pom.xml backend/src/main/resources/application.yml
git commit -m "build(backend): add PostHog Java dependency and config block"
```

### Task 2: PostHogService wrapper (TDD)

**Files:**
- Test: `backend/src/test/java/com/towin/common/service/PostHogServiceTest.java`
- Create: `backend/src/main/java/com/towin/common/service/PostHogService.java`

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/com/towin/common/service/PostHogServiceTest.java`:

```java
package com.towin.common.service;

import com.posthog.java.PostHog;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

class PostHogServiceTest {

    @Test
    void capture_whenDisabled_doesNotThrow() {
        PostHogService service = new PostHogService((PostHog) null);
        assertThatCode(() ->
                service.capture("user-1", "user_signed_up", Map.of("role", "ELDER")))
                .doesNotThrowAnyException();
    }

    @Test
    void capture_whenEnabled_delegatesToClient() {
        PostHog client = mock(PostHog.class);
        PostHogService service = new PostHogService(client);

        service.capture("user-1", "user_signed_up", Map.of("role", "ELDER"));

        verify(client).capture("user-1", "user_signed_up", Map.of("role", "ELDER"));
    }

    @Test
    void capture_whenDistinctIdNull_doesNotDelegate() {
        PostHog client = mock(PostHog.class);
        PostHogService service = new PostHogService(client);

        service.capture(null, "user_signed_up", Map.of());

        verifyNoInteractions(client);
    }

    @Test
    void shutdown_whenDisabled_doesNotThrow() {
        PostHogService service = new PostHogService((PostHog) null);
        assertThatCode(service::shutdown).doesNotThrowAnyException();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `backend/`: `./mvnw test -Dtest=PostHogServiceTest`
Expected: FAIL — compilation error, `PostHogService` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `backend/src/main/java/com/towin/common/service/PostHogService.java`:

```java
package com.towin.common.service;

import com.posthog.java.PostHog;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Sends product-analytics events to PostHog. Analytics is optional: when no
 * API key is configured (local dev, CI, tests) the service is a silent no-op,
 * so nothing depends on PostHog being reachable.
 */
@Service
public class PostHogService {

    private final PostHog postHog; // null when analytics is disabled

    @Autowired
    public PostHogService(@Value("${posthog.api-key:}") String apiKey,
                          @Value("${posthog.host:https://us.i.posthog.com}") String host) {
        this((apiKey == null || apiKey.isBlank())
                ? null
                : new PostHog.Builder(apiKey).host(host).build());
    }

    // Visible for testing — lets tests inject a mock (or null) client.
    PostHogService(PostHog postHog) {
        this.postHog = postHog;
    }

    /** Records an event for a user. No-op when disabled or distinctId is null. */
    public void capture(String distinctId, String event, Map<String, Object> properties) {
        if (postHog == null || distinctId == null) {
            return;
        }
        postHog.capture(distinctId, event, properties);
    }

    @PreDestroy
    public void shutdown() {
        if (postHog != null) {
            postHog.shutdown();
        }
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run from `backend/`: `./mvnw test -Dtest=PostHogServiceTest`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/towin/common/service/PostHogService.java \
        backend/src/test/java/com/towin/common/service/PostHogServiceTest.java
git commit -m "feat(backend): add PostHogService wrapper (no-op when unconfigured)"
```

### Task 3: Capture server-side events in AuthService (TDD)

**Files:**
- Modify: `backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java`
- Modify: `backend/src/test/java/com/towin/auth/service/AuthServiceTest.java`
- Modify: `backend/src/main/java/com/towin/auth/service/AuthService.java`

- [ ] **Step 1: Update the verify-email test to expect a captured event**

In `backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java`:

1. Add imports:
```java
import com.towin.common.service.PostHogService;
import java.util.Map;
```
2. Add a mock field next to the existing `@Mock UserRepository userRepository;`:
```java
    @Mock PostHogService postHogService;
```
3. In `verifyEmail_marksVerifiedAndClearsToken()`, after the existing `verify(userRepository).save(u);` line, add:
```java
        verify(postHogService).capture(u.getId().toString(), "email_verified", Map.of());
```

> Why the `@Mock` field is required: `AuthService` is built with `@InjectMocks`. Once `AuthService` gains a `PostHogService` constructor dependency, Mockito injects `null` for it unless a `@Mock` is present — which would NPE inside `verifyEmail`/`register`.

- [ ] **Step 2: Guard the other AuthService test against the new dependency**

In `backend/src/test/java/com/towin/auth/service/AuthServiceTest.java`, add the import and a mock field so `@InjectMocks` injects it (prevents NPE in any happy-path `register` test):
```java
import com.towin.common.service.PostHogService;
```
```java
    @Mock PostHogService postHogService;
```

- [ ] **Step 3: Run the tests to verify they fail**

Run from `backend/`: `./mvnw test -Dtest=AuthServiceVerifyEmailTest,AuthServiceTest`
Expected: `AuthServiceVerifyEmailTest` FAILS — `AuthService` has no `PostHogService` field yet (compile error), or the `verify(postHogService...)` is unsatisfied.

- [ ] **Step 4: Wire PostHogService into AuthService**

In `backend/src/main/java/com/towin/auth/service/AuthService.java`:

1. Add the import (with the other `com.towin.common.service` imports near line 11-13):
```java
import com.towin.common.service.PostHogService;
```
2. Add `java.util.Map` import (near the other `java.util` imports, line 22-24):
```java
import java.util.Map;
```
3. Add the dependency field after `private final EmailService emailService;` (line 42):
```java
    private final PostHogService postHogService;
```
4. In `register(...)`, immediately after the `emailService.sendVerificationEmail(...)` call (line 79-80) and before generating the token, add:
```java
        postHogService.capture(id, "user_signed_up", Map.of("role", saved.getRole().name()));
```
5. In `verifyEmail(...)`, after `userRepository.save(user);` (line 139), add:
```java
        postHogService.capture(user.getId().toString(), "email_verified", Map.of());
```

- [ ] **Step 5: Run the tests to verify they pass**

Run from `backend/`: `./mvnw test -Dtest=AuthServiceVerifyEmailTest,AuthServiceTest`
Expected: PASS — all tests green.

- [ ] **Step 6: Run the full backend test suite (regression check)**

Run from `backend/`: `./mvnw test`
Expected: BUILD SUCCESS — no other AuthService-dependent test broke.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/towin/auth/service/AuthService.java \
        backend/src/test/java/com/towin/auth/AuthServiceVerifyEmailTest.java \
        backend/src/test/java/com/towin/auth/service/AuthServiceTest.java
git commit -m "feat(backend): capture user_signed_up and email_verified PostHog events"
```

---

## Chunk 2: Frontend — init, identity, banner

> No frontend test harness. Each task ends with **manual verification** against `npm run dev` and the PostHog dashboard (Activity → Live events / Session replay). Set the two env vars in `frontend/.env` first (Task 4) so verification works.

### Task 4: Install posthog-js and document env vars

**Files:**
- Modify: `frontend/package.json` (+ lockfile, via npm)
- Modify: `frontend/.env.example`

- [ ] **Step 1: Install the package**

Run from `frontend/`: `npm install posthog-js`
Expected: `posthog-js` appears under `dependencies` in `frontend/package.json`.

- [ ] **Step 2: Document the env vars**

In `frontend/.env.example`, add below the existing `VITE_API_BASE_URL` line:

```
# PostHog product analytics (public project key — safe to ship in the client)
VITE_PUBLIC_POSTHOG_KEY=
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 3: Set local values for verification**

Create/append to `frontend/.env` (NOT committed — `.env` is gitignored) with your real PostHog project key:
```
VITE_PUBLIC_POSTHOG_KEY=phc_your_real_key
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 4: Commit (code + example only, never `.env`)**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.env.example
git commit -m "build(frontend): add posthog-js and document env vars"
```

### Task 5: Initialize PostHog in main.jsx (with session replay, guarded)

**Files:**
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Replace the file contents**

Replace `frontend/src/main.jsx` with:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.jsx'

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  // Auto-captures SPA pageviews on React Router navigation + clicks/forms.
  defaults: '2025-05-24',
  // Session replay on, but never record what users type (messages, emails,
  // passwords) — we still see clicks, scrolls and navigation.
  session_recording: {
    maskAllInputs: true,
  },
}

// When no key is configured (e.g. local dev without analytics) we render the
// app without the provider so nothing is sent and the app still works.
const tree = posthogKey
  ? (
      <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
        <App />
      </PostHogProvider>
    )
  : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {tree}
  </StrictMode>,
)
```

- [ ] **Step 2: Manual verification — events flow**

1. Run from `frontend/`: `npm run dev`
2. Open the app, click around a couple of pages.
3. In PostHog → Activity → Live events: confirm `$pageview` and `$autocapture` events appear.

- [ ] **Step 3: Manual verification — session replay**

In PostHog → Session replay: confirm a recording for your session appears, and that text you typed into inputs shows as masked (asterisks/blocks), not the real characters.

- [ ] **Step 4: Manual verification — no-key guard**

Temporarily comment out `VITE_PUBLIC_POSTHOG_KEY` in `frontend/.env`, restart `npm run dev`, and confirm: the app loads normally and the browser Network tab shows **no** requests to the PostHog host. Then restore the key.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/main.jsx
git commit -m "feat(frontend): initialize PostHog with autocapture and masked session replay"
```

### Task 6: Identify and reset the user in AuthContext

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`

- [ ] **Step 1: Import the posthog singleton**

At the top of `frontend/src/context/AuthContext.jsx`, after the React import (line 1), add:
```jsx
import posthog from 'posthog-js';
```

- [ ] **Step 2: Identify on login**

In the `login(token)` function, after `setUser({ ... })` (line 35), add:
```jsx
    posthog.identify(payload.sub, { role: payload.role });
```

- [ ] **Step 3: Reset on logout**

In the `logout()` function, after `setUser(null);` (line 40), add:
```jsx
    posthog.reset();
```

> The `posthog-js` singleton is safe to call even when uninitialized (no key) — these calls are inert in that case, so no guard is needed.

- [ ] **Step 4: Manual verification**

With a key set and `npm run dev` running: log in, then in PostHog → Activity → Live events confirm an `$identify` event tied to your user id appears; the prior anonymous events become associated with that person. Log out and confirm subsequent events are anonymous again.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/AuthContext.jsx
git commit -m "feat(frontend): identify user in PostHog on login, reset on logout"
```

### Task 7: Reword the info banner

**Files:**
- Modify: `frontend/src/components/CookieConsent.jsx`

- [ ] **Step 1: Update the banner copy**

In `frontend/src/components/CookieConsent.jsx`, replace the `<span>` content (lines 54-57) with copy that mentions analytics + session recording in plain, simple words, keeping the Privacy Policy link:

```jsx
      <span style={{ flex: 1, minWidth: 220 }}>
        We keep you signed in and use tools that record how the site is used
        (including replays of screen activity) to make it better. See our{' '}
        <Link to="/privacy" style={{ color: '#7cc4e8', textDecoration: 'underline' }}>Privacy Policy</Link>.
      </span>
```

> Keep everything else as-is: the single non-blocking "Got it" button, the `localStorage` show-once behaviour, and the styling. The banner does not gate tracking.

- [ ] **Step 2: Manual verification**

In a fresh browser profile (or after clearing the `cookieConsent` localStorage key), load the app: the reworded banner appears once, "Got it" dismisses it, and it does not reappear on reload. Tracking happens regardless of the banner.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CookieConsent.jsx
git commit -m "feat(frontend): mention analytics and session recording in info banner"
```

---

## Chunk 3: End-to-end verification & rollout

### Task 8: Verify merged frontend+backend timeline and document env vars for deploy

**Files:** none (verification + deploy config)

- [ ] **Step 1: Run the backend locally with a key**

From `backend/`, set `POSTHOG_API_KEY` to the same `phc_...` key (and optionally `POSTHOG_HOST`) in your environment, then start the backend (`./mvnw spring-boot:run`).

- [ ] **Step 2: End-to-end check — events merge by user id**

1. With both frontend and backend running and keyed: register a brand-new account, then verify its email via the emailed link.
2. In PostHog → Activity → Live events, confirm:
   - a backend `user_signed_up` event (with `role`) for the new user id,
   - a frontend `$identify` for the same user id,
   - a backend `email_verified` event for the same user id.
3. Open that person in PostHog and confirm frontend + backend events appear on one timeline (same `distinct_id`).

- [ ] **Step 3: Add the backend key to Railway**

In the Railway backend service variables, add `POSTHOG_API_KEY` (the `phc_...` key) and, if not US cloud, `POSTHOG_HOST`. (Use the use-railway skill if available.) Do not commit keys.

- [ ] **Step 4: Set the frontend build env var**

Wherever the frontend is built/served, set `VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` in that build environment.

- [ ] **Step 5: Final regression**

From `backend/`: `./mvnw test` → BUILD SUCCESS.
From `frontend/`: `npm run build` → build succeeds with no errors.

---

## Done criteria

- Backend: `user_signed_up` and `email_verified` events captured; full test suite passes; app boots and all flows work with **no** key set (no-op).
- Frontend: pageviews/clicks autocaptured, session replay recording with masked inputs, user identified on login / reset on logout, reworded one-time banner; app runs with **no** key set.
- Frontend and backend events for the same user merge under one `distinct_id`.
- No secrets committed; keys live in Railway / build env only.
