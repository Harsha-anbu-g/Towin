# Nominatim Geocoding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Nominatim geocoding so opening the app shows elders/helpers near you — with readable place names (reverse geocoding), a typed-address fallback when GPS is denied (forward geocoding), and a fix so helpers persist their location like elders do.

**Architecture:** A backend `GeocodingService` calls the public Nominatim API server-to-server via `RestClient` (same pattern as `EmailService`). Reverse geocoding hooks into the existing `ProfileService.updateLocation` to fill `User.city`. A new `GET /geocode/search` endpoint powers a frontend address-entry fallback shown inline on both dashboards when GPS is denied. All geocoding fails gracefully (never blocks a location save) and is cached.

**Tech Stack:** Spring Boot 3 (Java), `RestClient`, Spring Cache (Redis in prod / Caffeine fallback), React (Vite), axios.

**Spec:** `docs/superpowers/specs/2026-06-27-nominatim-geocoding-design.md`

---

## File Structure

**Backend (create):**
- `backend/src/main/java/com/towin/geocoding/GeocodingService.java` — Nominatim client (reverse + forward), caching, graceful failure
- `backend/src/main/java/com/towin/geocoding/dto/GeoResult.java` — `{ double lat, double lng, String city }`
- `backend/src/main/java/com/towin/geocoding/GeocodingController.java` — `GET /geocode/search`
- `backend/src/test/java/com/towin/geocoding/GeocodingServiceTest.java`

**Backend (modify):**
- `backend/src/main/java/com/towin/profile/service/ProfileService.java` — inject `GeocodingService`, set `city` in `updateLocation`
- `backend/src/main/java/com/towin/common/config/RedisConfig.java:38` — add `geocode-reverse`, `geocode-forward` cache names
- `backend/src/main/resources/application.yml` — `nominatim.*` config
- `backend/src/test/java/com/towin/profile/service/ProfileServiceTest.java` — add `@Mock GeocodingService`

**Frontend (create):**
- `frontend/src/components/LocationPrompt.jsx` — inline "enter your town/postcode" box

**Frontend (modify):**
- `frontend/src/pages/HelperDashboard.jsx:217` — persist GPS via `PUT /profile/location`; render `LocationPrompt` when denied
- `frontend/src/pages/ElderDashboard.jsx` — render `LocationPrompt` when denied

---

## Chunk 1: Backend GeocodingService

### Task 1: `GeoResult` DTO

**Files:**
- Create: `backend/src/main/java/com/towin/geocoding/dto/GeoResult.java`

- [ ] **Step 1: Create the DTO**

```java
package com.towin.geocoding.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class GeoResult {
    private double lat;
    private double lng;
    private String city;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/java/com/towin/geocoding/dto/GeoResult.java
git commit -m "feat(geocoding): add GeoResult DTO"
```

---

### Task 2: GeocodingService — reverse geocoding (TDD)

**Files:**
- Create: `backend/src/main/java/com/towin/geocoding/GeocodingService.java`
- Test: `backend/src/test/java/com/towin/geocoding/GeocodingServiceTest.java`

The service uses `RestClient` like `EmailService` (`backend/src/main/java/com/towin/common/service/EmailService.java:23`). Tests inject a mock `RestClient` through a package-visible constructor so no real HTTP happens.

- [ ] **Step 1: Write the failing test**

```java
package com.towin.geocoding;

import com.towin.geocoding.dto.GeoResult;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class GeocodingServiceTest {

    // Builds a GeocodingService whose RestClient returns `body` (or throws if null) for any GET.
    @SuppressWarnings("unchecked")
    private GeocodingService serviceReturning(Object body) {
        RestClient client = mock(RestClient.class);
        RestClient.RequestHeadersUriSpec uriSpec = mock(RestClient.RequestHeadersUriSpec.class);
        RestClient.RequestHeadersSpec headersSpec = mock(RestClient.RequestHeadersSpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(client.get()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString(), any(Object[].class))).thenReturn(headersSpec);
        when(uriSpec.uri(anyString())).thenReturn(headersSpec);
        when(headersSpec.header(anyString(), anyString())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        if (body == null) {
            when(responseSpec.body(any(Class.class))).thenThrow(new RuntimeException("timeout"));
            when(responseSpec.body(any(org.springframework.core.ParameterizedTypeReference.class)))
                    .thenThrow(new RuntimeException("timeout"));
        } else {
            when(responseSpec.body(any(Class.class))).thenReturn(body);
            when(responseSpec.body(any(org.springframework.core.ParameterizedTypeReference.class)))
                    .thenReturn(body);
        }
        return new GeocodingService(client, "ToWin-Test/1.0");
    }

    @Test
    void reverseGeocodeReturnsCityFromAddress() {
        Map<String, Object> body = Map.of(
                "address", Map.of("city", "Toronto", "country", "Canada"),
                "display_name", "Toronto, Ontario, Canada");
        GeocodingService svc = serviceReturning(body);

        String city = svc.reverseGeocode(43.65, -79.38);

        assertThat(city).isEqualTo("Toronto");
    }

    @Test
    void reverseGeocodeFallsBackThroughTownVillageSuburb() {
        Map<String, Object> body = Map.of(
                "address", Map.of("suburb", "Scarborough"),
                "display_name", "Scarborough, Toronto, Canada");
        GeocodingService svc = serviceReturning(body);

        assertThat(svc.reverseGeocode(43.77, -79.25)).isEqualTo("Scarborough");
    }

    @Test
    void reverseGeocodeReturnsNullOnError() {
        GeocodingService svc = serviceReturning(null); // RestClient throws

        assertThat(svc.reverseGeocode(43.65, -79.38)).isNull();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=GeocodingServiceTest`
Expected: FAIL — `GeocodingService` does not exist (compilation error).

- [ ] **Step 3: Write minimal implementation (reverse only)**

```java
package com.towin.geocoding;

import com.towin.geocoding.dto.GeoResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Turns coordinates into place names (reverse) and typed addresses into
 * coordinates (forward) using the public Nominatim/OpenStreetMap API.
 *
 * Nominatim's usage policy REQUIRES a descriptive User-Agent and a low request
 * rate, so all calls go through the backend (never the browser) and results are
 * cached. Any failure returns null/empty and is logged — geocoding must never
 * break a location save.
 */
@Slf4j
@Service
public class GeocodingService {

    private final RestClient client;
    private final String userAgent;

    // Spring constructor: builds a RestClient with short timeouts so a slow
    // Nominatim never holds up a user's location save.
    public GeocodingService(
            @Value("${nominatim.base-url:https://nominatim.openstreetmap.org}") String baseUrl,
            @Value("${nominatim.user-agent:ToWin/1.0 (agharsha.anbu@gmail.com)}") String userAgent) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.userAgent = userAgent;
    }

    // Test constructor: inject a mock RestClient directly.
    GeocodingService(RestClient client, String userAgent) {
        this.client = client;
        this.userAgent = userAgent;
    }

    @Cacheable(value = "geocode-reverse", key = "T(java.lang.Math).round(#lat*1000)+'-'+T(java.lang.Math).round(#lng*1000)")
    public String reverseGeocode(double lat, double lng) {
        try {
            Map<String, Object> body = client.get()
                    .uri("/reverse?format=jsonv2&lat={lat}&lon={lng}", lat, lng)
                    .header("User-Agent", userAgent)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            return cityFrom(body);
        } catch (Exception e) {
            log.warn("Reverse geocode failed for {},{}: {}", lat, lng, e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private String cityFrom(Map<String, Object> body) {
        if (body == null) return null;
        Object addr = body.get("address");
        if (addr instanceof Map<?, ?> a) {
            for (String key : List.of("city", "town", "village", "suburb")) {
                Object v = ((Map<String, Object>) a).get(key);
                if (v != null) return v.toString();
            }
        }
        Object display = body.get("display_name");
        if (display != null) {
            String first = display.toString().split(",")[0].trim();
            return first.isEmpty() ? null : first;
        }
        return null;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=GeocodingServiceTest`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/towin/geocoding/GeocodingService.java backend/src/test/java/com/towin/geocoding/GeocodingServiceTest.java
git commit -m "feat(geocoding): reverse geocoding via Nominatim"
```

---

### Task 3: GeocodingService — forward geocoding (TDD)

**Files:**
- Modify: `backend/src/main/java/com/towin/geocoding/GeocodingService.java`
- Test: `backend/src/test/java/com/towin/geocoding/GeocodingServiceTest.java`

- [ ] **Step 1: Add failing tests**

Append to `GeocodingServiceTest`:

```java
    @Test
    void forwardGeocodeReturnsTopHit() {
        List<Map<String, Object>> body = List.of(Map.of(
                "lat", "43.7731", "lon", "-79.2578",
                "display_name", "Scarborough, Toronto, Canada"));
        GeocodingService svc = serviceReturning(body);

        Optional<GeoResult> result = svc.forwardGeocode("Scarborough");

        assertThat(result).isPresent();
        assertThat(result.get().getLat()).isEqualTo(43.7731);
        assertThat(result.get().getLng()).isEqualTo(-79.2578);
        assertThat(result.get().getCity()).isEqualTo("Scarborough");
    }

    @Test
    void forwardGeocodeEmptyWhenNoMatch() {
        GeocodingService svc = serviceReturning(List.of());

        assertThat(svc.forwardGeocode("asdfghjkl")).isEmpty();
    }

    @Test
    void forwardGeocodeEmptyOnError() {
        GeocodingService svc = serviceReturning(null);

        assertThat(svc.forwardGeocode("Scarborough")).isEmpty();
    }

    @Test
    void forwardGeocodeBlankQueryReturnsEmpty() {
        GeocodingService svc = serviceReturning(List.of());

        assertThat(svc.forwardGeocode("   ")).isEmpty();
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw test -Dtest=GeocodingServiceTest`
Expected: FAIL — `forwardGeocode` not defined.

- [ ] **Step 3: Implement `forwardGeocode`**

Add to `GeocodingService`:

```java
    @Cacheable(value = "geocode-forward", key = "#query == null ? '' : #query.trim().toLowerCase()")
    public Optional<GeoResult> forwardGeocode(String query) {
        if (query == null || query.isBlank()) return Optional.empty();
        try {
            List<Map<String, Object>> hits = client.get()
                    .uri("/search?format=jsonv2&limit=1&q={q}", query.trim())
                    .header("User-Agent", userAgent)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});
            if (hits == null || hits.isEmpty()) return Optional.empty();
            Map<String, Object> top = hits.get(0);
            double lat = Double.parseDouble(top.get("lat").toString());
            double lng = Double.parseDouble(top.get("lon").toString());
            String city = null;
            Object display = top.get("display_name");
            if (display != null) city = display.toString().split(",")[0].trim();
            return Optional.of(new GeoResult(lat, lng, city));
        } catch (Exception e) {
            log.warn("Forward geocode failed for '{}': {}", query, e.getMessage());
            return Optional.empty();
        }
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && ./mvnw test -Dtest=GeocodingServiceTest`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/towin/geocoding/GeocodingService.java backend/src/test/java/com/towin/geocoding/GeocodingServiceTest.java
git commit -m "feat(geocoding): forward geocoding via Nominatim"
```

---

### Task 4: Register caches + config

**Files:**
- Modify: `backend/src/main/java/com/towin/common/config/RedisConfig.java:38`
- Modify: `backend/src/main/resources/application.yml`

- [ ] **Step 1: Add cache names**

In `RedisConfig.java`, change the `CaffeineCacheManager` constructor line to include the new caches:

```java
        CaffeineCacheManager manager = new CaffeineCacheManager(
                "discovery-elders", "discovery-helpers", "geocode-reverse", "geocode-forward");
```

(The Redis path needs no change — `RedisCacheManager` creates caches on demand.)

- [ ] **Step 2: Add Nominatim config**

Add to `backend/src/main/resources/application.yml` (top level, matching existing structure):

```yaml
nominatim:
  base-url: https://nominatim.openstreetmap.org
  user-agent: "ToWin/1.0 (agharsha.anbu@gmail.com)"
```

- [ ] **Step 3: Verify the app context loads**

Run: `cd backend && ./mvnw test -Dtest=GeocodingServiceTest`
Expected: PASS (still 7; this just confirms nothing broke).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/towin/common/config/RedisConfig.java backend/src/main/resources/application.yml
git commit -m "feat(geocoding): register geocode caches and Nominatim config"
```

---

## Chunk 2: Wire reverse geocoding + forward endpoint

### Task 5: Reverse-geocode on location save (TDD)

**Files:**
- Modify: `backend/src/main/java/com/towin/profile/service/ProfileService.java:84-90`
- Test: `backend/src/test/java/com/towin/profile/service/ProfileServiceTest.java`

- [ ] **Step 1: Add failing tests**

Add to `ProfileServiceTest` (and add `@Mock com.towin.geocoding.GeocodingService geocodingService;` field alongside the other mocks at line 27):

```java
    @Test
    void updateLocationSetsCityFromGeocoder() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(geocodingService.reverseGeocode(43.65, -79.38)).thenReturn("Toronto");

        profileService.updateLocation(userId, 43.65, -79.38);

        assertThat(user.getCity()).isEqualTo("Toronto");
        assertThat(user.getLocationLat().doubleValue()).isEqualTo(43.65);
    }

    @Test
    void updateLocationStillSavesCoordsWhenGeocodeFails() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).city("OldCity").isActive(true).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(geocodingService.reverseGeocode(anyDouble(), anyDouble())).thenReturn(null);

        profileService.updateLocation(userId, 1.0, 2.0);

        assertThat(user.getLocationLat().doubleValue()).isEqualTo(1.0);
        assertThat(user.getCity()).isEqualTo("OldCity"); // unchanged on null
    }
```

Add the import `import static org.mockito.ArgumentMatchers.anyDouble;` if not present.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw test -Dtest=ProfileServiceTest`
Expected: FAIL — `geocodingService` not a field / city not set.

- [ ] **Step 3: Implement**

In `ProfileService.java`, add the dependency field after line 22:

```java
    private final com.towin.geocoding.GeocodingService geocodingService;
```

Replace `updateLocation` (lines 83-90) with:

```java
    @Transactional
    public void updateLocation(UUID userId, Double lat, Double lng) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setLocationLat(lat != null ? BigDecimal.valueOf(lat) : null);
        user.setLocationLng(lng != null ? BigDecimal.valueOf(lng) : null);
        if (lat != null && lng != null) {
            String city = geocodingService.reverseGeocode(lat, lng);
            if (city != null) user.setCity(city);
        }
        userRepository.save(user);
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && ./mvnw test -Dtest=ProfileServiceTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/towin/profile/service/ProfileService.java backend/src/test/java/com/towin/profile/service/ProfileServiceTest.java
git commit -m "feat(geocoding): fill city on location save via reverse geocode"
```

---

### Task 6: Forward-geocode endpoint

**Files:**
- Create: `backend/src/main/java/com/towin/geocoding/GeocodingController.java`

Follow the auth pattern in `ProfileController` (`Authentication auth`, `UUID.fromString(auth.getName())`). Search needs auth but no user-specific logic, so we just require authentication.

- [ ] **Step 1: Create the controller**

```java
package com.towin.geocoding;

import com.towin.geocoding.dto.GeoResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/geocode")
@RequiredArgsConstructor
public class GeocodingController {

    private final GeocodingService geocodingService;

    // Returns the best lat/lng/city for a typed place, or 404 when nothing matches.
    @GetMapping("/search")
    public ResponseEntity<GeoResult> search(@RequestParam("q") String query) {
        return geocodingService.forwardGeocode(query)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
```

- [ ] **Step 2: Verify `/geocode/**` is authenticated, not public**

Check `backend/src/main/java/com/towin/common/security/SecurityConfig.java`. The default rule should require authentication for non-whitelisted paths. Confirm `/geocode` is NOT added to any `permitAll()` list. No change expected — just verify.

- [ ] **Step 3: Build to confirm it compiles**

Run: `cd backend && ./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/towin/geocoding/GeocodingController.java
git commit -m "feat(geocoding): add GET /geocode/search endpoint"
```

---

## Chunk 3: Frontend — helper fix + inline address box

### Task 7: Persist helper GPS (bug fix)

**Files:**
- Modify: `frontend/src/pages/HelperDashboard.jsx:214-218`

The Elder side already persists location (`ElderDashboard.jsx:282`); the Helper side does not. Add the same `PUT`.

- [ ] **Step 1: Add the persist call**

In `HelperDashboard.requestLocation`, change the success callback (around line 217) from:

```jsx
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc); setLocationStatus('granted'); loadNeeds(loc);
      },
```

to:

```jsx
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc); setLocationStatus('granted');
        api.put('/profile/location', { locationLat: loc.lat, locationLng: loc.lng }).catch(() => {});
        loadNeeds(loc);
      },
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HelperDashboard.jsx
git commit -m "fix(web): persist helper GPS location like the elder dashboard"
```

---

### Task 8: Shared `LocationPrompt` component

**Files:**
- Create: `frontend/src/components/LocationPrompt.jsx`

A self-contained box: text input + button. On submit it geocodes, persists, calls back. Brand colors unchanged — reuse existing utility/Tailwind classes already used in the dashboards (match surrounding card styling; do not introduce new colors).

- [ ] **Step 1: Create the component**

```jsx
import { useState } from 'react';
import api from '../api';

/**
 * Shown when GPS is denied/unavailable. Lets the user type a town or postcode;
 * on success it resolves coordinates, saves them, and tells the parent to
 * reload the nearby list. Used by both Elder and Helper dashboards.
 *
 * Props:
 *   onResolved({ lat, lng, city }) — called after a successful lookup + save
 */
export default function LocationPrompt({ onResolved }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | notfound | error
  const [city, setCity] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setStatus('loading');
    try {
      const { data } = await api.get(`/geocode/search?q=${encodeURIComponent(q)}`);
      const loc = { lat: data.lat, lng: data.lng };
      await api.put('/profile/location', { locationLat: loc.lat, locationLng: loc.lng }).catch(() => {});
      setCity(data.city);
      setStatus('idle');
      onResolved({ ...loc, city: data.city });
    } catch (err) {
      if (err?.response?.status === 404) setStatus('notfound');
      else setStatus('error');
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-700">
        Enter your town or postcode to see people near you
      </p>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. Scarborough or M1B 1A1"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {status === 'loading' ? 'Finding…' : 'Find'}
        </button>
      </form>
      {status === 'notfound' && (
        <p className="mt-2 text-sm text-amber-700">We couldn't find that place — try a postcode.</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-sm text-rose-700">Something went wrong. Please try again.</p>
      )}
      {city && status === 'idle' && (
        <p className="mt-2 text-sm text-emerald-700">Showing people near {city}.</p>
      )}
    </div>
  );
}
```

> Note: match the exact button/input classes to the dashboard's existing style if they differ (check the radius selector / post-need form). The brand color is sky-blue; reuse whatever class the dashboards already use for primary buttons rather than hardcoding a new shade.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LocationPrompt.jsx
git commit -m "feat(web): add shared LocationPrompt address-entry component"
```

---

### Task 9: Show `LocationPrompt` on both dashboards when GPS denied

**Files:**
- Modify: `frontend/src/pages/ElderDashboard.jsx` (discover/helpers tab area)
- Modify: `frontend/src/pages/HelperDashboard.jsx` (discover/needs tab area)

- [ ] **Step 1: Elder dashboard**

Add the import near the other component imports:

```jsx
import LocationPrompt from '../components/LocationPrompt';
```

In the "discover" tab render (where `helpers` are listed), when `locationStatus === 'denied'` render the prompt above the list:

```jsx
{locationStatus === 'denied' && (
  <LocationPrompt onResolved={(loc) => {
    setLocation({ lat: loc.lat, lng: loc.lng });
    setLocationStatus('granted');
    loadHelpers({ lat: loc.lat, lng: loc.lng });
  }} />
)}
```

- [ ] **Step 2: Helper dashboard**

Add the same import. In the discover/needs render, when `locationStatus === 'denied'`:

```jsx
{locationStatus === 'denied' && (
  <LocationPrompt onResolved={(loc) => {
    setLocation({ lat: loc.lat, lng: loc.lng });
    setLocationStatus('granted');
    loadNeeds({ lat: loc.lat, lng: loc.lng });
    loadElders({ lat: loc.lat, lng: loc.lng });
  }} />
)}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ElderDashboard.jsx frontend/src/pages/HelperDashboard.jsx
git commit -m "feat(web): show address-entry fallback when GPS denied"
```

---

## Chunk 4: Verification

### Task 10: Full backend test run + manual smoke

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && ./mvnw test`
Expected: BUILD SUCCESS, all tests pass.

- [ ] **Step 2: Manual smoke (local)**

Start backend (`:8080`) and frontend (`:5173`). Then:
1. Log in as a real (non-demo) elder. Allow the GPS prompt → confirm a city appears on helper cards (reverse geocode worked).
2. Block location in the browser, reload dashboard → confirm the `LocationPrompt` box appears. Type a town → list populates and city shows.
3. Repeat (1) and (2) as a helper. Confirm an elder can now see "X km away" for that helper (helper-location persistence fix).

- [ ] **Step 3: Final confirmation**

Confirm: real users get city names; GPS-denied users have a working fallback; helpers persist location. Done.

---

## Notes / Gotchas

- **Nominatim fair use:** public instance allows ~1 req/sec and requires the User-Agent header (set in config). The `@Cacheable` + coordinate rounding (3 decimals ≈ 110 m) keep volume low. If usage ever grows, switch `nominatim.base-url` to a self-hosted instance — no code change.
- **Brand colors:** the `LocationPrompt` must reuse the dashboards' existing sky-blue primary-button class, not a new shade. Verify against the radius selector / post-need form styling before finalizing Task 8.
- **No DB migration needed:** `User.city`, `location_lat`, `location_lng` already exist.
- **Demo users** are seeded with "Toronto" and are unaffected.
