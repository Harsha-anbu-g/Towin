# Browse Needs Sub-tabs + Posted-time Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute top to bottom; commit after each task.

**Goal:** Add a "Posted … ago" timestamp to every Browse Needs card and split the helper's Browse Needs tab into Available · Applied · Completed sub-tabs backed by real, refresh-persistent application data.

**Architecture:** Backend gains a per-viewer `myApplicationStatus` on `NeedResponse` plus a `GET /api/needs/applications` endpoint so a helper can read the needs they applied to/completed. Frontend adds a `bseg` URL sub-segment (reusing `SegmentedTabs`), a `postedAgo` helper, and an extracted `NeedCard` so all three segments render identically.

**Tech Stack:** Spring Boot (Java 17, Lombok, JPA), React (Vite, react-router `useSearchParams`).

Spec: `docs/superpowers/specs/2026-06-30-browse-needs-subtabs-design.md`

---

## Chunk 1: Backend — helper application read path

### Task 1: `myApplicationStatus` on NeedResponse

**Files:**
- Modify: `backend/src/main/java/com/towin/need/dto/NeedResponse.java`

- [ ] **Step 1:** Add field (the `com.towin.common.enums.*` wildcard import already covers `ApplicationStatus`):

```java
private NeedStatus status;
private ApplicationStatus myApplicationStatus;   // viewer's own application state, null if none
private Double distanceKm;
```

### Task 2: Repository query

**Files:**
- Modify: `backend/src/main/java/com/towin/need/repository/NeedApplicationRepository.java`

- [ ] **Step 1:** Add finder:

```java
List<NeedApplication> findByHelperId(UUID helperId);
```

### Task 3: Service — populate status on browse + new getMyApplications

**Files:**
- Modify: `backend/src/main/java/com/towin/need/service/NeedService.java`

- [ ] **Step 1:** Add `import java.util.Map;` next to the existing `java.util` imports.

- [ ] **Step 2:** Add a batch helper (place near the bottom, by the other private helpers):

```java
private Map<UUID, ApplicationStatus> helperApplicationMap(UUID helperId) {
    return applicationRepository.findByHelperId(helperId).stream()
            .collect(Collectors.toMap(a -> a.getNeed().getId(), NeedApplication::getStatus, (a, b) -> a));
}
```

- [ ] **Step 3:** Rewrite `getAllOpen` to set the viewer's status:

```java
public List<NeedResponse> getAllOpen(UUID helperId) {
    Map<UUID, ApplicationStatus> myApps = helperApplicationMap(helperId);
    return needRepository.findByStatusOrderByCreatedAtDesc(NeedStatus.OPEN)
            .stream()
            .map(n -> toResponse(n, null, false, myApps.get(n.getId())))
            .collect(Collectors.toList());
}
```

- [ ] **Step 4:** In `browseNearby`, capture the map before the stream and pass it in the final `map`:

```java
public List<NeedResponse> browseNearby(UUID helperId, Double lat, Double lng, Double radiusKm, int page, int size) {
    User helper = getUser(helperId);
    Map<UUID, ApplicationStatus> myApps = helperApplicationMap(helperId);
    double helperLat = lat != null ? lat : (helper.getLocationLat() != null ? helper.getLocationLat().doubleValue() : 0);
    double helperLng = lng != null ? lng : (helper.getLocationLng() != null ? helper.getLocationLng().doubleValue() : 0);

    return needRepository.findOpenNeedsWithLocation(NeedStatus.OPEN)
            .stream()
            .map(n -> {
                double dist = haversineKm(helperLat, helperLng,
                        n.getLocationLat().doubleValue(), n.getLocationLng().doubleValue());
                return new Object[]{n, dist};
            })
            .filter(pair -> (double) pair[1] <= radiusKm)
            .sorted((a, b) -> Double.compare((double) a[1], (double) b[1]))
            .skip((long) page * size)
            .limit(size)
            .map(pair -> {
                Need n = (Need) pair[0];
                return toResponse(n, (double) pair[1], false, myApps.get(n.getId()));
            })
            .collect(Collectors.toList());
}
```

- [ ] **Step 5:** Add `getMyApplications`:

```java
public List<NeedResponse> getMyApplications(UUID helperId) {
    return applicationRepository.findByHelperId(helperId).stream()
            .filter(a -> a.getStatus() != ApplicationStatus.WITHDRAWN)
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .map(a -> toResponse(a.getNeed(), null, false, a.getStatus()))
            .collect(Collectors.toList());
}
```

- [ ] **Step 6:** Extend the `toResponse` overload chain to carry `myStatus`. Replace the two existing overloads + the full method with:

```java
private NeedResponse toResponse(Need need, Double distanceKm) {
    return toResponse(need, distanceKm, false, null);
}

private NeedResponse toResponse(Need need, Double distanceKm, boolean includeApplicants) {
    return toResponse(need, distanceKm, includeApplicants, null);
}

private NeedResponse toResponse(Need need, Double distanceKm, boolean includeApplicants, ApplicationStatus myStatus) {
    // ... body unchanged, but add .myApplicationStatus(myStatus) to the builder ...
}
```

Add `.myApplicationStatus(myStatus)` to the `NeedResponse.builder()` chain (next to `.status(...)`).

### Task 4: Controller endpoint

**Files:**
- Modify: `backend/src/main/java/com/towin/need/controller/NeedController.java`

- [ ] **Step 1:** Add (place above the `/{needId}` GET so intent is clear — Spring matches the literal `/applications` before the path variable regardless of order):

```java
@GetMapping("/applications")
public ResponseEntity<List<NeedResponse>> getMyApplications(Authentication auth) {
    UUID userId = UUID.fromString(auth.getName());
    return ResponseEntity.ok(needService.getMyApplications(userId));
}
```

### Task 5: Test + build

**Files:**
- Modify: `backend/src/test/java/com/towin/need/service/NeedServiceTest.java`

- [ ] **Step 1:** Add a test that a helper with a PENDING application on an OPEN need gets it back from `getMyApplications` with `myApplicationStatus == PENDING`, and that `getAllOpen` marks that same need's `myApplicationStatus == PENDING` while an un-applied need stays `null`. (Match the existing test style/mocks in the file.)

- [ ] **Step 2:** Build + test:

Run: `cd backend && ./mvnw -q test -Dtest=NeedServiceTest`
Expected: BUILD SUCCESS / tests pass.

- [ ] **Step 3:** Commit:

```bash
git add backend/src/main/java/com/towin/need backend/src/test/java/com/towin/need
git commit -m "feat(api): expose helper application status + GET /needs/applications"
```

---

## Chunk 2: Frontend — posted-time + sub-tabs

**File:** `frontend/src/pages/HelperDashboard.jsx` (all steps)

### Task 6: `postedAgo` helper + `NeedCard` component

- [ ] **Step 1:** Add `postedAgo` near the other module-level helpers (after `catLabel`):

```jsx
// Plain, everyday relative time — "just now", "2 days ago", "3 weeks ago".
function postedAgo(iso) {
  if (!iso) return '';
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return 'just now';
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} week${w === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}
```

- [ ] **Step 2:** Extract a module-level `NeedCard` that renders one request and derives its action area from `need.myApplicationStatus` + `need.status`. It appends `· {postedAgo(need.createdAt)}` to the meta line. Props: `{ need, index, applying, onApply, onWithdraw, onOpenProfile }`.
  - `need.status === 'COMPLETED'` → green pill "✓ Completed", no button.
  - `myApplicationStatus === 'ACCEPTED'` → green pill "✓ You're helping".
  - `myApplicationStatus === 'PENDING'` → slate pill "Waiting to hear back" + "Withdraw" button (`onWithdraw`).
  - otherwise → "Offer to Help" button (`onApply`, disabled while `applying === need.id`).
  - Reuse the exact card/meta/urgent-pill markup currently inline in the browse tab (lines ~666–716) so styling is unchanged.

### Task 7: State, loaders, sub-segment param

- [ ] **Step 1:** Add state: `const [myApplications, setMyApplications] = useState([]);`

- [ ] **Step 2:** Add loader:

```jsx
async function loadMyApplications() {
  try { const r = await api.get('/needs/applications'); setMyApplications(r.data); } catch {}
}
```

- [ ] **Step 3:** Sub-segment param (near the `eseg` lines):

```jsx
const browseSeg = searchParams.get('bseg') || 'available';
const setBrowseSeg = (next) => setParam('bseg', next);
```

- [ ] **Step 4:** In the `tab`/`radiusKm` effect, load applications too:

```jsx
if (tab === 'browse') { loadNeeds(); loadMyApplications(); }
```

- [ ] **Step 5:** In `apply()` and `withdrawApplication()`, after the existing reload, also `await loadMyApplications();` so segments/counts update.

### Task 8: Segment lists + render

- [ ] **Step 1:** Compute derived lists + segments (near `elderSegments`):

```jsx
const availableNeeds = [...needs].filter(n => !n.myApplicationStatus).sort(sortNeeds);
const appliedNeeds = myApplications.filter(n =>
  (n.status === 'OPEN' || n.status === 'ASSIGNED') &&
  (n.myApplicationStatus === 'PENDING' || n.myApplicationStatus === 'ACCEPTED'));
const completedNeeds = myApplications.filter(n =>
  n.status === 'COMPLETED' && n.myApplicationStatus === 'ACCEPTED');
const browseSegments = [
  { id: 'available', label: 'Available', count: availableNeeds.length },
  { id: 'applied',   label: 'Applied',   count: appliedNeeds.length },
  { id: 'completed', label: 'Completed', count: completedNeeds.length },
];
```

- [ ] **Step 2:** In the `tab === 'browse'` block, render `<SegmentedTabs segments={browseSegments} value={browseSeg} onChange={setBrowseSeg} />` under the header.
  - Show `RadiusBar` + location primer/prompt + the existing "No requests found" block ONLY when `browseSeg === 'available'` (distance/location is meaningless for Applied/Completed).
  - Map the active segment's list to `<NeedCard … />`.
  - For `applied`/`completed` empty lists, render `<SegmentEmpty>` with a friendly message ("You haven't offered to help with anything yet." / "No completed requests yet. Finished requests you helped with show up here.").

### Task 9: Verify + commit

- [ ] **Step 1:** Build the frontend:

Run: `cd frontend && npm run build`
Expected: build succeeds, no lint/JSX errors.

- [ ] **Step 2:** Smoke-check with dev server + Playwright (webapp-testing): open helper dashboard → Browse Needs, confirm the three sub-tabs render, each card shows "Posted … ago", switching `bseg` updates the list, and Applied persists across reload.

- [ ] **Step 3:** Commit:

```bash
git add frontend/src/pages/HelperDashboard.jsx
git commit -m "feat(web): posted-time + Available/Applied/Completed sub-tabs in Browse Needs"
```

---

## Done criteria

- Every Browse Needs card shows a plain "Posted … ago" line.
- Browse Needs has Available · Applied · Completed sub-tabs with live counts.
- Applied/Completed survive a page refresh (backed by `GET /needs/applications`).
- Backend `NeedServiceTest` passes; frontend builds clean.
