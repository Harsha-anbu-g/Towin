# Nominatim Geocoding — Design

**Date:** 2026-06-27
**Status:** Approved
**Goal:** When a user opens the app, show elders and helpers near them — with readable place names, and a working fallback for users who deny or lack GPS.

## Background

The proximity/discovery feature already exists and works:

- Frontend captures browser GPS once on dashboard load (`navigator.geolocation.getCurrentPosition`) — `ElderDashboard.jsx:277`, `HelperDashboard.jsx:214`.
- Coordinates are saved via `PUT /profile/location` → `ProfileController.updateLocation` → `ProfileService.updateLocation`.
- `DiscoveryService` computes haversine distance, filters by radius, and sorts nearest-first.
- Cards already render "X km away".

GPS capture is a **one-time snapshot on open**, not continuous tracking. This is intentional: it avoids battery drain and constant-location privacy concerns for elderly users, and "near me" only needs roughly where someone is, not live movement. This design keeps that behavior.

### Gaps this design closes

1. **No place names for real users.** `User.city` is only populated by the demo seeder ("Toronto"). Real users get raw lat/lng, so cards show "km away" but no place name. → Reverse geocoding (lat/lng → city/area).
2. **No-GPS users see nobody.** If a user denies the location prompt (common on desktop / privacy-shy seniors), they get no location and an empty list. → Forward geocoding (typed town/postcode → lat/lng).
3. **Helper location is never persisted.** `HelperDashboard.requestLocation` sets location in-session but never calls `PUT /profile/location` (unlike the Elder side at `ElderDashboard.jsx:282`). So helpers have no stored location and elders can't see how far away they are. → Bug fix included here.

## Approach

**Backend-side geocoding (Approach A).** A `GeocodingService` calls Nominatim server-to-server via `RestClient`.

Rationale: Nominatim's usage policy requires a valid `User-Agent` and ≤1 req/sec — a browser can't set a proper User-Agent and every client would hit OSM separately. The backend gives a single point for User-Agent, caching, and rate-limiting; avoids CORS; and keeps city logic next to where location is already saved.

## Components

### 1. `GeocodingService` (new package `com.towin.geocoding`)

Wraps Nominatim via `RestClient`, mirroring the `EmailService` Brevo client pattern.

- `String reverseGeocode(double lat, double lng)` — `GET /reverse?format=jsonv2&lat=..&lon=..`. Extracts a friendly area name in priority order: `address.city` → `address.town` → `address.village` → `address.suburb` → first part of `display_name`. Returns `null` on no result/error.
- `GeoResult forwardGeocode(String query)` — `GET /search?format=jsonv2&limit=1&q=..`. Returns the top hit as `{ lat, lng, city }`, or empty `Optional` on no match/error.
- **Compliance & safety:** configurable `User-Agent` (required by Nominatim), short connect/read timeouts (~3s), and graceful failure — any error/timeout returns null/empty and is logged at WARN; never throws to callers.
- **Caching:** `@Cacheable` on both methods with new cache names `geocode-reverse` and `geocode-forward`, added to `RedisConfig`. Reverse-geocode cache key rounds lat/lng to ~3 decimal places (~110m) so nearby coordinates share a cache entry, reducing calls and staying well under rate limits.

**Config** (`application.yml`, read via `@Value` with defaults):
- `nominatim.base-url` — default `https://nominatim.openstreetmap.org`
- `nominatim.user-agent` — default `ToWin/1.0 (agharsha.anbu@gmail.com)`

### 2. Reverse geocoding wired into location saves

`ProfileService.updateLocation(userId, lat, lng)`: after saving lat/lng, call `reverseGeocode` and set `user.city`. This method backs `PUT /profile/location` for **both** dashboards, so elders and helpers both get a city automatically. If geocoding returns null, lat/lng still save and city is left unchanged.

### 3. Forward-geocode endpoint

New `GeocodingController`: `GET /geocode/search?q=...` → `{ lat, lng, city }`, or 404/empty body when no match. Authenticated like the rest of the API. Used by the dashboard's no-GPS fallback; the result is then persisted through the existing `PUT /profile/location` (which re-runs reverse geocoding to normalize the city name).

### 4. Frontend — helper fix + inline address box

- **Bug fix:** add `api.put('/profile/location', { locationLat, locationLng })` to `HelperDashboard.requestLocation` so helpers persist GPS exactly like elders (`HelperDashboard.jsx:217`).
- **Inline fallback:** when `locationStatus === 'denied'`, render a small "Enter your town or postcode to see people near you" input on both dashboards. On submit → `GET /geocode/search`:
  - hit → set location, `PUT /profile/location`, reload the nearby list;
  - miss → show "We couldn't find that place — try a postcode."
- A shared `LocationPrompt` component used by both dashboards (one well-bounded unit, identical UI/logic). Brand colors unchanged — typography/layout only.

## Data flow

```
GPS path:    browser GPS (one-time on open) → PUT /profile/location
                 → save lat/lng → reverseGeocode → save city
No-GPS path: type "Scarborough" → GET /geocode/search → {lat,lng,city}
                 → PUT /profile/location → save + normalize city
Discovery:   unchanged — DiscoveryService haversine sorts by distance & shows city
```

## Error handling

- Geocoding never blocks a location save. Timeout/error → location still persists; city left as-is (reverse) or user told "couldn't find that place" (forward).
- All Nominatim failures logged at WARN with the query/coords for debugging.

## Testing

- `GeocodingService` unit tests with a mocked `RestClient`: reverse hit, forward hit, no-match, timeout → empty/null.
- `ProfileService.updateLocation` test: city set on success; lat/lng still saved when geocoding fails.
- Manual: deny GPS → type a town → list populates and cards show the city; allow GPS → city appears automatically.

## Out of scope (YAGNI)

- Address autocomplete-as-you-type.
- Self-hosting Nominatim (public instance is fine at this scale; cache + coordinate rounding keep us within fair use).
- Map pins / visual map.
- Continuous/live location tracking (one-time snapshot is intentional).
