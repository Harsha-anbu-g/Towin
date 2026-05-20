# Profile Completeness & Trust Score Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend elder profiles with social/occupation/DOB fields, show per-field point values (+0.25 pts each) in the Trust page BasicCard with a link to the profile page, and recalculate trust score whenever a profile is saved.

**Architecture:** Add `facebook_url`, `instagram_url`, `occupation` columns to `elder_profiles` via a Flyway migration, wire them through the entity/DTO/service layer, then update `TrustScoreService` to read from both `ElderProfile` and `HelperProfile` when computing the basic score. On the frontend, expose those fields for all roles in `ProfileEdit.jsx`, and enhance `Trust.jsx` `BasicCard` to show the point value per field and a navigation link to the profile page.

**Tech Stack:** Spring Boot 3 / JPA / Flyway / PostgreSQL · React 18 / React Router v6 / inline styles only · Sky-blue palette (#4FA3CE, #3D8AB0, #EAF5FB) · SF Pro fonts

---

## File Structure

| File | Change |
|------|--------|
| `backend/src/main/resources/db/migration/V19__add_social_fields_to_elder_profiles.sql` | CREATE — adds facebook_url, instagram_url, occupation to elder_profiles |
| `backend/src/main/java/com/towin/profile/entity/ElderProfile.java` | MODIFY — add 3 new fields |
| `backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java` | MODIFY — add facebookUrl, instagramUrl, occupation, dateOfBirth |
| `backend/src/main/java/com/towin/profile/service/ProfileService.java` | MODIFY — save new elder fields, call recalculate, expose in response |
| `backend/src/main/java/com/towin/common/service/TrustScoreService.java` | MODIFY — inject ElderProfileRepository, score/fields for elders |
| `frontend/src/pages/ProfileEdit.jsx` | MODIFY — show social/occupation/DOB for all roles, include in elder save |
| `frontend/src/pages/Trust.jsx` | MODIFY — show +0.25 pts per field, add link to profile |

---

## Chunk 1: Backend — Elder profile social fields + trust score recalculation

### Task 1: Flyway migration + ElderProfile entity + ElderProfileRequest

**Files:**
- Create: `backend/src/main/resources/db/migration/V19__add_social_fields_to_elder_profiles.sql`
- Modify: `backend/src/main/java/com/towin/profile/entity/ElderProfile.java`
- Modify: `backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java`

- [ ] **Step 1: Write the migration**

Create `backend/src/main/resources/db/migration/V19__add_social_fields_to_elder_profiles.sql`:

```sql
ALTER TABLE elder_profiles
    ADD COLUMN IF NOT EXISTS facebook_url  VARCHAR(500),
    ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS occupation    VARCHAR(255);
```

- [ ] **Step 2: Add fields to ElderProfile entity**

In `backend/src/main/java/com/towin/profile/entity/ElderProfile.java`, add these three fields after the `languages` field (before the `lookingFor` field):

```java
@Column(name = "facebook_url")
private String facebookUrl;

@Column(name = "instagram_url")
private String instagramUrl;

@Column(name = "occupation")
private String occupation;
```

The class already has `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder` from Lombok — no further changes needed for accessor methods.

- [ ] **Step 3: Add fields to ElderProfileRequest**

Open `backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java`. The current fields are: name, age, bio, photoUrl, interests, languages, lookingFor. Add these optional fields at the end of the class body:

```java
import java.time.LocalDate;

// inside the class:
private String facebookUrl;
private String instagramUrl;
private String occupation;
private LocalDate dateOfBirth;
```

`LocalDate` may already be imported — check before adding the import.

- [ ] **Step 4: Verify the backend still compiles**

```bash
cd /Users/aghar/Documents/Projects/ToWin/backend
./mvnw compile -q
```

Expected: BUILD SUCCESS with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/migration/V19__add_social_fields_to_elder_profiles.sql \
        backend/src/main/java/com/towin/profile/entity/ElderProfile.java \
        backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java
git commit -m "feat: add facebook_url, instagram_url, occupation to elder_profiles"
```

---

### Task 2: ProfileService — save new elder fields + call recalculate + expose in response

**Files:**
- Modify: `backend/src/main/java/com/towin/profile/service/ProfileService.java`

- [ ] **Step 1: Update createOrUpdateElderProfile to save the new fields**

In `ProfileService.createOrUpdateElderProfile` (currently lines 25–43), after the existing `profile.setLookingFor(...)` block and before `elderProfileRepository.save(profile)`, add:

```java
profile.setFacebookUrl(request.getFacebookUrl());
profile.setInstagramUrl(request.getInstagramUrl());
profile.setOccupation(request.getOccupation());
// DOB is stored on the users table, not elder_profiles
if (request.getDateOfBirth() != null) {
    user.setDateOfBirth(request.getDateOfBirth());
    userRepository.save(user);
}
```

Then after `elderProfileRepository.save(profile)`, call trust recalculation:

```java
elderProfileRepository.save(profile);
trustScoreService.recalculate(userId);          // ← add this line
return buildProfileResponse(user, profile, null);
```

- [ ] **Step 2: Expose new elder fields in buildProfileResponse**

In `buildProfileResponse` (currently lines 122–162), inside the `if (elder != null)` block, add `.facebookUrl(elder.getFacebookUrl()).instagramUrl(elder.getInstagramUrl()).occupation(elder.getOccupation())` to the builder chain. The `dateOfBirth` is already set from `user.getDateOfBirth()` in the base builder above, so no change needed there.

The final `if (elder != null)` block should look like:

```java
if (elder != null) {
    builder.name(elder.getName())
            .age(elder.getAge())
            .photoUrl(elder.getPhotoUrl())
            .bio(elder.getBio())
            .interests(elder.getInterests())
            .languages(elder.getLanguages())
            .lookingFor(elder.getLookingFor().name())
            .facebookUrl(elder.getFacebookUrl())
            .instagramUrl(elder.getInstagramUrl())
            .occupation(elder.getOccupation());
}
```

- [ ] **Step 3: Verify the backend compiles**

```bash
cd /Users/aghar/Documents/Projects/ToWin/backend
./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/towin/profile/service/ProfileService.java
git commit -m "feat: save elder social/occupation/dob fields and recalculate trust score on elder profile save"
```

---

### Task 3: TrustScoreService — handle ElderProfile for basic score and fields

**Files:**
- Modify: `backend/src/main/java/com/towin/common/service/TrustScoreService.java`

**Background:** Currently `TrustScoreService` only reads `HelperProfile` (`p`) in both `calculateBasicScore` and `buildProfileFields`. For elder users, `p` is `null` so they only earn points for id_verified and phone_verified. After this task, elders earn points for photo, social (fb or ig), occupation, bio, and dob (from `user.getDateOfBirth()`).

- [ ] **Step 1: Inject ElderProfileRepository**

Add `ElderProfileRepository` to the constructor injection at the top of `TrustScoreService`. The class uses `@RequiredArgsConstructor`, so just add a field:

```java
private final ElderProfileRepository elderProfileRepository;
```

Import: `import com.towin.profile.repository.ElderProfileRepository;`

The existing fields are: `userRepository`, `helperProfileRepository`, `reviewRepository`, `connectionRepository`.

- [ ] **Step 2: Update getMyScoreBreakdown to fetch elder profile**

In `getMyScoreBreakdown` (line 46), after fetching `HelperProfile profile`, also fetch the elder profile:

```java
HelperProfile profile = helperProfileRepository.findByUserId(userId).orElse(null);
ElderProfile elderProfile = elderProfileRepository.findByUserId(userId).orElse(null);
```

Then update the two calls to pass elderProfile:

```java
double basic = calculateBasicScore(user, profile, elderProfile);
// ...
.basic(BasicSection.builder()
        .earned(basic)
        .max(2.0)
        .fields(buildProfileFields(user, profile, elderProfile))
        .build())
```

Import: `import com.towin.profile.entity.ElderProfile;`

- [ ] **Step 3: Update recalculate to fetch elder profile**

In `recalculate` (line 33), after fetching `HelperProfile profile`:

```java
ElderProfile elderProfile = elderProfileRepository.findByUserId(userId).orElse(null);
double basic = calculateBasicScore(user, profile, elderProfile);
```

- [ ] **Step 4: Update calculateBasicScore to handle both profile types**

Replace the current `calculateBasicScore(User user, HelperProfile p)` signature and body with:

```java
private double calculateBasicScore(User user, HelperProfile p, ElderProfile e) {
    double score = 0.0;
    if (user.getVerificationStatus() == VerificationStatus.VERIFIED) score += 0.25;
    if (user.isPhoneVerified())                                        score += 0.25;

    // Helper-specific fields
    if (p != null) {
        if (notBlank(p.getPhotoUrl()))                                     score += 0.25;
        if (notBlank(p.getFacebookUrl()) || notBlank(p.getInstagramUrl())) score += 0.25;
        if (p.getHobbies() != null && p.getHobbies().length > 0)          score += 0.25;
        if (notBlank(p.getOccupation()))                                   score += 0.25;
        if (notBlank(p.getBio()))                                          score += 0.25;
        if (p.getDateOfBirth() != null)                                    score += 0.25;
    }

    // Elder-specific fields (DOB comes from users table)
    if (e != null) {
        if (notBlank(e.getPhotoUrl()))                                     score += 0.25;
        if (notBlank(e.getFacebookUrl()) || notBlank(e.getInstagramUrl())) score += 0.25;
        if (notBlank(e.getOccupation()))                                   score += 0.25;
        if (notBlank(e.getBio()))                                          score += 0.25;
        if (user.getDateOfBirth() != null)                                 score += 0.25;
    }

    return Math.min(score, 2.0);
}
```

- [ ] **Step 5: Update buildProfileFields to handle both profile types**

Replace the current `buildProfileFields(User user, HelperProfile p)` signature and body with:

```java
private List<ProfileField> buildProfileFields(User user, HelperProfile p, ElderProfile e) {
    List<ProfileField> fields = new ArrayList<>();
    fields.add(field("id_verified", "Identity Verified",
            user.getVerificationStatus() == VerificationStatus.VERIFIED,
            "Upload a government ID in Profile → Verification."));
    fields.add(field("phone_verified", "Phone Verified",
            user.isPhoneVerified(),
            "Verify your phone number in Profile → Verification."));

    if (p != null) {
        fields.add(field("photo",      "Profile Photo",
                notBlank(p.getPhotoUrl()),
                "Add a clear photo so elders feel comfortable."));
        fields.add(field("social",     "Social Media",
                notBlank(p.getFacebookUrl()) || notBlank(p.getInstagramUrl()),
                "Link your Facebook or Instagram in your profile."));
        fields.add(field("hobbies",    "Hobbies",
                p.getHobbies() != null && p.getHobbies().length > 0,
                "Add at least one hobby — shared interests start friendships."));
        fields.add(field("occupation", "Occupation",
                notBlank(p.getOccupation()),
                "Add your occupation — context builds trust."));
        fields.add(field("bio",        "About Me",
                notBlank(p.getBio()),
                "Write a short bio in your own words."));
        fields.add(field("dob",        "Date of Birth",
                p.getDateOfBirth() != null,
                "Add your date of birth in your profile."));
    }

    if (e != null) {
        fields.add(field("photo",      "Profile Photo",
                notBlank(e.getPhotoUrl()),
                "Add a clear photo so others feel comfortable."));
        fields.add(field("social",     "Social Media",
                notBlank(e.getFacebookUrl()) || notBlank(e.getInstagramUrl()),
                "Link your Facebook or Instagram in your profile."));
        fields.add(field("occupation", "Occupation",
                notBlank(e.getOccupation()),
                "Add your occupation — context builds trust."));
        fields.add(field("bio",        "About Me",
                notBlank(e.getBio()),
                "Write a short bio in your own words."));
        fields.add(field("dob",        "Date of Birth",
                user.getDateOfBirth() != null,
                "Add your date of birth in your profile."));
    }

    return fields;
}
```

- [ ] **Step 6: Verify backend compiles and tests pass**

```bash
cd /Users/aghar/Documents/Projects/ToWin/backend
./mvnw compile -q
./mvnw test -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS and no test failures.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/towin/common/service/TrustScoreService.java
git commit -m "feat: score elder profiles on photo, social, occupation, bio, dob fields"
```

---

## Chunk 2: Frontend — Profile fields for all roles + Trust score with points

### Task 4: ProfileEdit.jsx — social/occupation/DOB for all roles

**Files:**
- Modify: `frontend/src/pages/ProfileEdit.jsx`

**Background:** Currently Facebook URL, Instagram URL, Occupation, and Date of Birth fields are inside the `{!isElder && (...)}` block (lines 357–392). Elders never see them. We need to move them to a shared section visible to all roles, and include them in the elder `save()` call.

- [ ] **Step 1: Move shared fields out of the helper-only block**

In `ProfileEdit.jsx`, find the form's field list. There is a `{isElder && (...)}` block with elder-only fields (Interests, Looking For) and a `{!isElder && (...)}` block with helper-only fields (Skills Offered, Availability Days, Availability Times, Hobbies, Occupation, Facebook URL, Instagram URL, Date of Birth).

Move the following four fields OUT of the `{!isElder && (...)}` block and place them AFTER both the elder-only and helper-only conditional blocks (i.e., after the closing `</>` of `{!isElder && (...)}` but still inside the `<form>`) — these will show for ALL roles:

```jsx
{/* ── Shared fields (all roles) ── */}
<Divider />
<FieldRow label="Date of Birth">
  <input {...f('dateOfBirth')} type="date" style={{ width: '100%', boxSizing: 'border-box' }} />
</FieldRow>
<Divider />
<FieldRow label="Occupation">
  <input {...f('occupation')} placeholder="e.g. Retired teacher, Artist" style={{ width: '100%', boxSizing: 'border-box' }} />
</FieldRow>
<Divider />
<FieldRow label="Facebook URL">
  <input {...f('facebookUrl')} placeholder="https://facebook.com/yourname" style={{ width: '100%', boxSizing: 'border-box' }} />
</FieldRow>
<Divider />
<FieldRow label="Instagram URL">
  <input {...f('instagramUrl')} placeholder="https://instagram.com/yourname" style={{ width: '100%', boxSizing: 'border-box' }} />
</FieldRow>
```

Remove those same four fields from inside the `{!isElder && (...)}` block (Skills Offered, Availability Days/Times, Hobbies remain helper-only).

The helper-only block should now only contain:
```jsx
{!isElder && (
  <>
    <Divider />
    <FieldRow label="Skills Offered">
      <input {...f('skillsOffered')} placeholder="Driving, Cooking, Tech help" style={{ width: '100%', boxSizing: 'border-box' }} />
    </FieldRow>
    <Divider />
    <FieldRow label="Availability Days">
      <input {...f('availabilityDays')} placeholder="Monday, Wednesday" style={{ width: '100%', boxSizing: 'border-box' }} />
    </FieldRow>
    <Divider />
    <FieldRow label="Availability Times">
      <input {...f('availabilityTimes')} placeholder="Morning, Afternoon" style={{ width: '100%', boxSizing: 'border-box' }} />
    </FieldRow>
    <Divider />
    <FieldRow label="Hobbies">
      <input {...f('hobbies')} placeholder="Reading, Hiking, Cooking" style={{ width: '100%', boxSizing: 'border-box' }} />
    </FieldRow>
  </>
)}
```

- [ ] **Step 2: Include new fields in elder save()**

In the `save()` function (lines 162–185), the elder PUT currently sends only `name, age, bio, interests, languages, lookingFor`. Update it to also send the four shared fields:

```js
await api.put('/profile/elder', {
  name: form.name, age: Number(form.age), bio: form.bio,
  interests: toArr(form.interests), languages: toArr(form.languages), lookingFor: form.lookingFor,
  facebookUrl: form.facebookUrl || null,
  instagramUrl: form.instagramUrl || null,
  occupation: form.occupation || null,
  dateOfBirth: form.dateOfBirth || null,
});
```

No changes needed to the helper save — it already sends those four fields.

- [ ] **Step 3: Verify fields pre-populate when profile loads**

The `useEffect` that fetches `/profile/me` and populates `form` state (lines 79–100) already maps `occupation`, `facebookUrl`, `instagramUrl`, `dateOfBirth` from the API response. No changes needed there.

- [ ] **Step 4: Test manually in browser**

1. Log in as an elder user
2. Navigate to `/profile`
3. Confirm you see: Date of Birth, Occupation, Facebook URL, Instagram URL fields below the elder-only section
4. Fill them in and click "Save Profile"
5. Reload the page — confirm values are still pre-populated (round-trip works)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProfileEdit.jsx
git commit -m "feat: show occupation, social links, and DOB for all roles in profile edit"
```

---

### Task 5: Trust.jsx BasicCard — point values + link to profile

**Files:**
- Modify: `frontend/src/pages/Trust.jsx`

**Background:** The `BasicCard` component shows a 2-column grid of profile fields with ✓/○ icons but no point values and no way to navigate to the profile to fix them. We need to:
1. Import `useNavigate` from `react-router-dom`
2. Show "+0.25 pts" next to each field label
3. Add a "Complete your profile →" button at the bottom of the card that navigates to `/profile`
4. Make incomplete fields show a subtle "Add →" nudge

- [ ] **Step 1: Add useNavigate import**

At the top of `Trust.jsx`, the existing import is:
```js
import { useEffect, useState } from 'react';
```

Add `useNavigate` to the react-router-dom import below it:
```js
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add navigate to Trust component**

Inside `export default function Trust()`, add:
```js
const navigate = useNavigate();
```

- [ ] **Step 3: Pass navigate into BasicCard**

Update the `BasicCard` call:
```jsx
<BasicCard basic={data.basic} onGoToProfile={() => navigate('/profile')} />
```

- [ ] **Step 4: Update BasicCard signature and add the navigate prop**

Change `function BasicCard({ basic })` to `function BasicCard({ basic, onGoToProfile })`.

- [ ] **Step 5: Update each field row to show point value and nudge**

Replace the field row inside the `.map()` in `BasicCard`. The current code is:
```jsx
{basic.fields.map(f => (
  <div key={f.key} style={{
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px 14px', borderRadius: '12px',
    background: f.completed ? BG : '#fafafa',
    border: `1px solid ${f.completed ? '#BFD9EA' : '#f0f0f0'}`,
  }}>
    <span style={{ fontSize: '15px', marginTop: '1px', color: f.completed ? BLUE : '#c0c0c8' }}>
      {f.completed ? '✓' : '○'}
    </span>
    <div>
      <p style={{
        fontFamily: SF, fontSize: '13px', fontWeight: 600,
        color: f.completed ? BLUE : '#1d1d1f', margin: '0 0 2px',
      }}>
        {f.label}
      </p>
      {!f.completed && f.tip && (
        <p style={{ fontFamily: SF, fontSize: '11px', color: '#a0a0a5', margin: 0, lineHeight: 1.4 }}>
          {f.tip}
        </p>
      )}
    </div>
  </div>
))}
```

Replace with:
```jsx
{basic.fields.map(f => (
  <div key={f.key} style={{
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px 14px', borderRadius: '12px',
    background: f.completed ? BG : '#fafafa',
    border: `1px solid ${f.completed ? '#BFD9EA' : '#f0f0f0'}`,
  }}>
    <span style={{ fontSize: '15px', marginTop: '1px', color: f.completed ? BLUE : '#c0c0c8' }}>
      {f.completed ? '✓' : '○'}
    </span>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <p style={{
          fontFamily: SF, fontSize: '13px', fontWeight: 600,
          color: f.completed ? BLUE : '#1d1d1f', margin: '0 0 2px',
        }}>
          {f.label}
        </p>
        <span style={{
          fontFamily: SF, fontSize: '11px', fontWeight: 700,
          color: f.completed ? BLUE : '#a0a0a5',
          background: f.completed ? 'rgba(61,138,176,0.08)' : 'transparent',
          borderRadius: '9999px', padding: f.completed ? '2px 7px' : '0',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {f.completed ? '+0.25 pts ✓' : '+0.25 pts'}
        </span>
      </div>
      {!f.completed && f.tip && (
        <p style={{ fontFamily: SF, fontSize: '11px', color: '#a0a0a5', margin: 0, lineHeight: 1.4 }}>
          {f.tip}
        </p>
      )}
    </div>
  </div>
))}
```

- [ ] **Step 6: Add "Complete your profile →" button below the field grid**

After the closing `</div>` of the grid div (the one with `gridTemplateColumns: '1fr 1fr'`), add:

```jsx
{basic.earned < basic.max && (
  <div style={{ marginTop: '20px', textAlign: 'center' }}>
    <button
      onClick={onGoToProfile}
      style={{
        background: SKY, color: '#fff', border: 'none',
        borderRadius: '9999px', padding: '12px 28px',
        fontSize: '14px', fontWeight: 700, fontFamily: SF,
        cursor: 'pointer', boxShadow: '0 4px 14px rgba(79,163,206,0.3)',
      }}
    >
      Complete your profile →
    </button>
    <p style={{ fontFamily: SF, fontSize: '12px', color: '#a0a0a5', margin: '8px 0 0' }}>
      Each completed field adds +0.25 pts to your trust score
    </p>
  </div>
)}
```

- [ ] **Step 7: Test manually in browser**

1. Log in as any user and navigate to `/trust`
2. Confirm each field in the basic section shows "+0.25 pts" on the right side
3. Completed fields show "+0.25 pts ✓" with a sky-blue tinted pill
4. If profile is incomplete, the "Complete your profile →" button appears at the bottom
5. Click that button — confirm it navigates to `/profile`
6. Fill in a field (e.g. Occupation) and save
7. Navigate back to `/trust` — confirm that field is now checked ✓ and the earned score has gone up

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Trust.jsx
git commit -m "feat: show +0.25 pts per field in trust BasicCard and add link to profile"
```
