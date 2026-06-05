# Trust Score v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing single-formula trust score with a three-part system: Basic Score (profile completeness, max 2 pts), Rooting Score (stages completed across relationships, no cap), and Review Score (cumulative sum of all ratings, no cap).

**Architecture:** No new tables. `V17` migration adds 5 columns to `helper_profiles` (hobbies, occupation, facebook_url, instagram_url, date_of_birth). `TrustScoreService` is rewritten to compute three sub-scores from existing rows in `users`, `helper_profiles`, `connections`, and `reviews`. The `recalculate(UUID)` method signature stays the same so all 5 existing callers compile without change. `TrustScoreBreakdownResponse` is redesigned to a 3-section DTO. `Trust.jsx` is rewritten to show three distinct score cards.

**Tech Stack:** Spring Boot 3 / JPA / PostgreSQL / Flyway · React 18 / inline styles · SF Pro fonts · sky-blue palette (#4FA3CE, #3D8AB0, #EAF5FB, #BFD9EA)

---

## Scoring Rules Reference

### Basic Score (double, 0.0 – 2.0)

Each of the 8 profile fields is worth **0.25 pts**:

| Field          | Source                                                  |
| -------------- | ------------------------------------------------------- |
| ID verified    | `user.verificationStatus == VERIFIED`                   |
| Phone verified | `user.phoneVerified`                                    |
| Profile photo  | `helperProfile.photoUrl` not blank                      |
| Social media   | `helperProfile.facebookUrl` OR `instagramUrl` not blank |
| Hobbies        | `helperProfile.hobbies` array not empty                 |
| Occupation     | `helperProfile.occupation` not blank                    |
| Bio            | `helperProfile.bio` not blank                           |
| Date of birth  | `helperProfile.dateOfBirth` not null                    |

If `helperProfile` is null (elder-only users), only the first two fields can score → max 0.5.

### Rooting Score (int, cumulative)

For each active connection, count how many of the **5 spec stages** have been reached (based on `connection.currentTrustLevel`):

| TrustLevel value | Spec stage reached    | Cumulative pts from this connection |
| ---------------- | --------------------- | ----------------------------------- |
| DISCOVERED (0)   | —                     | 0                                   |
| MESSAGING (1)    | Stage 1: Text         | 1                                   |
| PHONE_CALL (2)   | Stage 2: Voice        | 2                                   |
| VIDEO_CALL (3)   | Stage 3: Video        | 3                                   |
| VERIFIED (4)     | _(not a spec stage)_  | 3                                   |
| FIRST_MEET (5)   | Stage 4: In-person    | 4                                   |
| TRUSTED (6)      | Stage 5: Help session | 5                                   |

Total Rooting Score = sum of stage points across all active connections.

### Review Score (int, cumulative)

Elders rate helpers 1–5 stars. Each star = 1 pt. The Review Score is the running total of all star ratings ever received.

`SELECT COALESCE(SUM(r.rating), 0) FROM reviews r WHERE r.reviewee_id = :userId`

Max per review = 5. No cap on total.

### Tier Thresholds (updated)

| Score  | Tier               |
| ------ | ------------------ |
| 0–2    | New Member         |
| 3–14   | Getting Started    |
| 15–49  | Reliable           |
| 50–119 | Highly Trusted     |
| 120+   | Community Champion |

---

## File Structure

### Backend — modified files

| File                                                                         | Change                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `backend/src/main/resources/db/migration/V17__add_profile_fields.sql`        | NEW — add 5 columns to `helper_profiles`                                         |
| `backend/src/main/java/com/towin/profile/entity/HelperProfile.java`          | Add 5 new fields                                                                 |
| `backend/src/main/java/com/towin/profile/dto/HelperProfileRequest.java`      | Add 5 new fields                                                                 |
| `backend/src/main/java/com/towin/profile/service/ProfileService.java`        | Save new fields; inject TrustScoreService; call recalculate() after profile save |
| `backend/src/main/java/com/towin/review/repository/ReviewRepository.java`    | Add `sumRatingsByRevieweeId` query                                               |
| `backend/src/main/java/com/towin/trust/dto/TrustScoreBreakdownResponse.java` | Redesign to 3-section DTO                                                        |
| `backend/src/main/java/com/towin/common/service/TrustScoreService.java`      | Full rewrite of scoring logic                                                    |
| `backend/src/test/java/com/towin/trust/service/TrustScoreServiceTest.java`   | Replace old tests with new ones                                                  |

### Frontend — modified files

| File                           | Change                      |
| ------------------------------ | --------------------------- |
| `frontend/src/pages/Trust.jsx` | Rewrite to 3-section layout |

---

## Chunk 1: Backend

### Task 1: V17 Migration

**Files:**

- Create: `backend/src/main/resources/db/migration/V17__add_profile_fields.sql`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE helper_profiles
    ADD COLUMN IF NOT EXISTS hobbies         TEXT[],
    ADD COLUMN IF NOT EXISTS occupation      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS facebook_url    VARCHAR(500),
    ADD COLUMN IF NOT EXISTS instagram_url   VARCHAR(500),
    ADD COLUMN IF NOT EXISTS date_of_birth   DATE;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/resources/db/migration/V17__add_profile_fields.sql
git commit -m "feat: V17 add hobbies/occupation/social/dob to helper_profiles"
```

---

### Task 2: Update HelperProfile Entity + HelperProfileRequest DTO

**Files:**

- Modify: `backend/src/main/java/com/towin/profile/entity/HelperProfile.java`
- Modify: `backend/src/main/java/com/towin/profile/dto/HelperProfileRequest.java`

- [ ] **Step 1: Add fields to HelperProfile entity**

Add these fields inside the class body (after `availabilityTimes`):

```java
@JdbcTypeCode(SqlTypes.ARRAY)
@Column(columnDefinition = "text[]")
private String[] hobbies;

@Column(name = "occupation")
private String occupation;

@Column(name = "facebook_url")
private String facebookUrl;

@Column(name = "instagram_url")
private String instagramUrl;

@Column(name = "date_of_birth")
private java.time.LocalDate dateOfBirth;
```

- [ ] **Step 2: Add fields to HelperProfileRequest DTO**

Add these fields to `HelperProfileRequest.java`:

```java
private String[] hobbies;
private String occupation;
private String facebookUrl;
private String instagramUrl;
private java.time.LocalDate dateOfBirth;
```

- [ ] **Step 3: Compile to verify**

```bash
cd backend && ./mvnw compile -q
# Expected: BUILD SUCCESS (just warnings)
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/towin/profile/
git commit -m "feat: add hobbies/occupation/social/dob fields to HelperProfile"
```

---

### Task 3: Update ProfileService to Save New Fields

**Files:**

- Modify: `backend/src/main/java/com/towin/profile/service/ProfileService.java`

- [ ] **Step 1: Add TrustScoreService injection**

In `ProfileService`, the class already has `@RequiredArgsConstructor`. Add this field:

```java
private final TrustScoreService trustScoreService;
```

(Add it at the top of the field list alongside `userRepository`, etc.)

- [ ] **Step 2: Update `createOrUpdateHelperProfile` to save new fields and recalculate**

Find the block where `profile.setAvailabilityTimes(...)` is called. After it, add:

```java
profile.setHobbies(request.getHobbies());
profile.setOccupation(request.getOccupation());
profile.setFacebookUrl(request.getFacebookUrl());
profile.setInstagramUrl(request.getInstagramUrl());
profile.setDateOfBirth(request.getDateOfBirth());
```

Then, after `helperProfileRepository.save(profile);`, add:

```java
trustScoreService.recalculate(userId);
```

- [ ] **Step 3: Compile to verify**

```bash
cd backend && ./mvnw compile -q
# Expected: BUILD SUCCESS
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/towin/profile/service/ProfileService.java
git commit -m "feat: save new profile fields and recalculate trust score on helper profile save"
```

---

### Task 4: Add sumRatingsByRevieweeId to ReviewRepository

**Files:**

- Modify: `backend/src/main/java/com/towin/review/repository/ReviewRepository.java`

- [ ] **Step 1: Add the query method**

Add this method to `ReviewRepository`:

```java
@Query("SELECT COALESCE(SUM(r.rating), 0) FROM Review r WHERE r.reviewee.id = :userId")
int sumRatingsByRevieweeId(@Param("userId") UUID userId);
```

- [ ] **Step 2: Compile to verify**

```bash
cd backend && ./mvnw compile -q
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/towin/review/repository/ReviewRepository.java
git commit -m "feat: add sumRatingsByRevieweeId to ReviewRepository"
```

---

### Task 5: Redesign TrustScoreBreakdownResponse DTO

**Files:**

- Modify: `backend/src/main/java/com/towin/trust/dto/TrustScoreBreakdownResponse.java`

- [ ] **Step 1: Replace the DTO with the new 3-section structure**

Replace the entire file content:

```java
package com.towin.trust.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class TrustScoreBreakdownResponse {

    private double totalScore;
    private String tier;

    private BasicSection basic;
    private RootingSection rooting;
    private ReviewSection review;

    @Data
    @Builder
    public static class BasicSection {
        private double earned;
        private double max;
        private List<ProfileField> fields;
    }

    @Data
    @Builder
    public static class ProfileField {
        private String key;
        private String label;
        private boolean completed;
        private String tip;
    }

    @Data
    @Builder
    public static class RootingSection {
        private int earned;
        private int relationshipCount;
        private String detail;
    }

    @Data
    @Builder
    public static class ReviewSection {
        private int earned;
        private int reviewCount;
        private String detail;
    }
}
```

- [ ] **Step 2: Compile — expect failures in TrustScoreService**

```bash
cd backend && ./mvnw compile 2>&1 | grep "error:" | head -20
# Expected: errors in TrustScoreService (references old Criterion class — normal, will fix in Task 6)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/towin/trust/dto/TrustScoreBreakdownResponse.java
git commit -m "refactor: redesign TrustScoreBreakdownResponse to 3-section DTO"
```

---

### Task 6: Rewrite TrustScoreService (TDD)

**Files:**

- Create/replace: `backend/src/test/java/com/towin/trust/service/TrustScoreServiceTest.java`
- Modify: `backend/src/main/java/com/towin/common/service/TrustScoreService.java`

> Note: The existing `TrustScoreServiceTest.java` tests the old system. We replace it entirely.

- [ ] **Step 1: Write the failing tests**

Replace `backend/src/test/java/com/towin/trust/service/TrustScoreServiceTest.java` with:

```java
package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class TrustScoreServiceTest {

    @Mock UserRepository userRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock ConnectionRepository connectionRepository;

    @InjectMocks TrustScoreService trustScoreService;

    UUID userId = UUID.randomUUID();
    User baseUser;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        baseUser = User.builder()
                .id(userId)
                .email("t@t.com").phone("123").passwordHash("x")
                .phoneVerified(false)
                .verificationStatus(VerificationStatus.NONE)
                .trustScore(0)
                .build();
    }

    // --- Basic Score ---

    @Test
    void basicScore_0_25_whenOnlyPhoneVerified() {
        baseUser.setPhoneVerified(true);
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(any(), any())).thenReturn(List.of());
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getBasic().getEarned()).isEqualTo(0.25);
    }

    @Test
    void basicScore_2_0_whenAllEightFieldsFilled() {
        baseUser.setPhoneVerified(true);
        baseUser.setVerificationStatus(VerificationStatus.VERIFIED);
        HelperProfile profile = HelperProfile.builder()
                .photoUrl("https://photo.jpg")
                .facebookUrl("https://facebook.com/me")
                .hobbies(new String[]{"reading"})
                .occupation("Teacher")
                .bio("Hello")
                .dateOfBirth(LocalDate.of(1960, 1, 1))
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(connectionRepository.findByUserAndStatus(any(), any())).thenReturn(List.of());
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getBasic().getEarned()).isEqualTo(2.0);
        assertThat(r.getBasic().getMax()).isEqualTo(2.0);
    }

    // --- Rooting Score ---

    @Test
    void rootingScore_1_whenOneConnectionAtMessaging() {
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.MESSAGING).status(ConnectionStatus.ACTIVE).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(1);
    }

    @Test
    void rootingScore_5_whenOneConnectionAtTrusted() {
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.TRUSTED).status(ConnectionStatus.ACTIVE).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(5);
    }

    @Test
    void rootingScore_3_whenConnectionAtVerified_verifiedIsNotASpecStage() {
        // VERIFIED(4) is between VIDEO_CALL(3) and FIRST_MEET(5).
        // It is not a spec stage, so it should earn the same as VIDEO_CALL = 3 pts.
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.VERIFIED).status(ConnectionStatus.ACTIVE).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(3);
    }

    @Test
    void rootingScore_isAdditiveAcrossConnections() {
        Connection c1 = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.MESSAGING).status(ConnectionStatus.ACTIVE).build();
        Connection c2 = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.PHONE_CALL).status(ConnectionStatus.ACTIVE).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c1, c2));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        // c1 = 1 pt (MESSAGING), c2 = 2 pts (PHONE_CALL) → total = 3
        assertThat(r.getRooting().getEarned()).isEqualTo(3);
        assertThat(r.getRooting().getRelationshipCount()).isEqualTo(2);
    }

    // --- Review Score ---

    @Test
    void reviewScore_isSumNotAverage() {
        // Three reviews: 5★, 3★, 4★ → sum = 12 (not avg 4)
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(any(), any())).thenReturn(List.of());
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(12);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getReview().getEarned()).isEqualTo(12);
    }

    @Test
    void rootingScore_0_whenConnectionAtDiscovered() {
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.DISCOVERED).status(ConnectionStatus.ACTIVE).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(0);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        assertThat(r.getRooting().getEarned()).isEqualTo(0);
    }

    // --- Total ---

    @Test
    void totalScore_isSumOfThreeParts() {
        baseUser.setPhoneVerified(true); // basic = 0.25
        Connection c = Connection.builder()
                .userA(baseUser).userB(User.builder().id(UUID.randomUUID()).build())
                .currentTrustLevel(TrustLevel.MESSAGING).status(ConnectionStatus.ACTIVE).build();
        when(userRepository.findById(userId)).thenReturn(Optional.of(baseUser));
        when(helperProfileRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)).thenReturn(List.of(c));
        when(reviewRepository.sumRatingsByRevieweeId(userId)).thenReturn(10);
        when(reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId)).thenReturn(List.of());

        TrustScoreBreakdownResponse r = trustScoreService.getMyScoreBreakdown(userId);

        // 0.25 (basic) + 1 (rooting) + 10 (review) = 11.25
        assertThat(r.getTotalScore()).isEqualTo(11.25);
    }
}
```

- [ ] **Step 2: Run tests — expect compile failure (TrustScoreService still old)**

```bash
cd backend && ./mvnw test -Dtest=TrustScoreServiceTest --no-transfer-progress 2>&1 | grep -E "error:|FAIL|BUILD" | head -10
# Expected: compile error — HelperProfileRepository not found in TrustScoreService
```

- [ ] **Step 3: Rewrite TrustScoreService**

Replace `backend/src/main/java/com/towin/common/service/TrustScoreService.java` entirely:

```java
package com.towin.common.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.VerificationStatus;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.dto.TrustScoreBreakdownResponse;
import com.towin.trust.dto.TrustScoreBreakdownResponse.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TrustScoreService {

    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ConnectionRepository connectionRepository;

    @Transactional
    public void recalculate(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        HelperProfile profile = helperProfileRepository.findByUserId(userId).orElse(null);

        double basic   = calculateBasicScore(user, profile);
        int rooting    = calculateRootingScore(userId);
        int review     = reviewRepository.sumRatingsByRevieweeId(userId);

        user.setTrustScore((int) Math.round(basic + rooting + review));
        userRepository.save(user);
    }

    public TrustScoreBreakdownResponse getMyScoreBreakdown(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        HelperProfile profile = helperProfileRepository.findByUserId(userId).orElse(null);

        // --- Basic ---
        double basic = calculateBasicScore(user, profile);
        List<ProfileField> fields = buildProfileFields(user, profile);

        // --- Rooting ---
        List<Connection> active = connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE);
        int rootingScore = active.stream().mapToInt(c -> stagesEarned(c.getCurrentTrustLevel())).sum();

        // --- Review ---
        int reviewScore = reviewRepository.sumRatingsByRevieweeId(userId);
        int reviewCount = reviewRepository.findByRevieweeIdOrderByCreatedAtDesc(userId).size();

        double total = basic + rootingScore + reviewScore;

        return TrustScoreBreakdownResponse.builder()
                .totalScore(total)
                .tier(tierFor((int) Math.round(total)))
                .basic(BasicSection.builder()
                        .earned(basic)
                        .max(2.0)
                        .fields(fields)
                        .build())
                .rooting(RootingSection.builder()
                        .earned(rootingScore)
                        .relationshipCount(active.size())
                        .detail(active.size() + " active " + (active.size() == 1 ? "relationship" : "relationships")
                                + " · " + rootingScore + " stage " + (rootingScore == 1 ? "point" : "points") + " earned")
                        .build())
                .review(ReviewSection.builder()
                        .earned(reviewScore)
                        .reviewCount(reviewCount)
                        .detail(reviewCount + (reviewCount == 1 ? " review" : " reviews")
                                + " · " + reviewScore + " total " + (reviewScore == 1 ? "point" : "points"))
                        .build())
                .build();
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private double calculateBasicScore(User user, HelperProfile profile) {
        double score = 0.0;
        if (user.getVerificationStatus() == VerificationStatus.VERIFIED) score += 0.25;
        if (user.isPhoneVerified()) score += 0.25;
        if (profile != null) {
            if (notBlank(profile.getPhotoUrl()))    score += 0.25;
            if (notBlank(profile.getFacebookUrl()) || notBlank(profile.getInstagramUrl())) score += 0.25;
            if (profile.getHobbies() != null && profile.getHobbies().length > 0)          score += 0.25;
            if (notBlank(profile.getOccupation()))  score += 0.25;
            if (notBlank(profile.getBio()))          score += 0.25;
            if (profile.getDateOfBirth() != null)   score += 0.25;
        }
        return Math.min(score, 2.0);
    }

    private int calculateRootingScore(UUID userId) {
        return connectionRepository.findByUserAndStatus(userId, ConnectionStatus.ACTIVE)
                .stream().mapToInt(c -> stagesEarned(c.getCurrentTrustLevel())).sum();
    }

    private int stagesEarned(TrustLevel level) {
        int v = level.getValue();
        int pts = 0;
        if (v >= TrustLevel.MESSAGING.getValue())   pts++; // Stage 1
        if (v >= TrustLevel.PHONE_CALL.getValue())  pts++; // Stage 2
        if (v >= TrustLevel.VIDEO_CALL.getValue())  pts++; // Stage 3
        if (v >= TrustLevel.FIRST_MEET.getValue())  pts++; // Stage 4 (VERIFIED=4 skipped: 4 < 5)
        if (v >= TrustLevel.TRUSTED.getValue())     pts++; // Stage 5
        return pts;
    }

    private List<ProfileField> buildProfileFields(User user, HelperProfile p) {
        List<ProfileField> fields = new ArrayList<>();
        fields.add(field("id_verified",   "Identity Verified",
                user.getVerificationStatus() == VerificationStatus.VERIFIED,
                "Upload a government ID in Profile → Verification."));
        fields.add(field("phone_verified", "Phone Verified",
                user.isPhoneVerified(),
                "Verify your phone number in Profile → Verification."));
        if (p != null) {
            fields.add(field("photo",       "Profile Photo",        notBlank(p.getPhotoUrl()),
                    "Add a clear profile photo so elders feel comfortable."));
            fields.add(field("social",      "Social Media",
                    notBlank(p.getFacebookUrl()) || notBlank(p.getInstagramUrl()),
                    "Link your Facebook or Instagram in your profile."));
            fields.add(field("hobbies",     "Hobbies",
                    p.getHobbies() != null && p.getHobbies().length > 0,
                    "Add at least one hobby — shared interests start friendships."));
            fields.add(field("occupation",  "Occupation",           notBlank(p.getOccupation()),
                    "Add your occupation — context helps elders trust you."));
            fields.add(field("bio",         "About Me",             notBlank(p.getBio()),
                    "Write a short bio about who you are."));
            fields.add(field("dob",         "Date of Birth",        p.getDateOfBirth() != null,
                    "Add your date of birth in your profile."));
        }
        return fields;
    }

    private ProfileField field(String key, String label, boolean completed, String tip) {
        return ProfileField.builder()
                .key(key).label(label).completed(completed)
                .tip(completed ? null : tip)
                .build();
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    public static String tierFor(int score) {
        if (score >= 120) return "Community Champion";
        if (score >= 50)  return "Highly Trusted";
        if (score >= 15)  return "Reliable";
        if (score >= 3)   return "Getting Started";
        return "New Member";
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && ./mvnw test -Dtest=TrustScoreServiceTest --no-transfer-progress 2>&1 | grep -E "Tests run|BUILD" | head -5
# Expected: Tests run: 8, Failures: 0, Errors: 0 — BUILD SUCCESS
```

- [ ] **Step 5: Compile full project to catch any broken callers**

```bash
cd backend && ./mvnw compile -q
# Expected: BUILD SUCCESS
# If errors: the old TrustScoreBreakdownResponse.Criterion usages need updating
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/towin/common/service/TrustScoreService.java \
        backend/src/test/java/com/towin/trust/service/TrustScoreServiceTest.java
git commit -m "feat: Trust Score v2 — Basic + Rooting + Review; 7 TDD tests passing"
```

---

## Chunk 2: Frontend

### Task 7: Rewrite Trust.jsx

**Files:**

- Modify: `frontend/src/pages/Trust.jsx`

The page calls `GET /api/trust/my-score` which returns the new 3-section DTO:

```json
{
  "totalScore": 11.25,
  "tier": "Getting Started",
  "basic": { "earned": 0.25, "max": 2.0, "fields": [...] },
  "rooting": { "earned": 1, "relationshipCount": 1, "detail": "..." },
  "review": { "earned": 10, "reviewCount": 1, "detail": "..." }
}
```

- [ ] **Step 1: Replace Trust.jsx with the new 3-section layout**

Replace the entire file:

```jsx
import { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import api from "../api/axios";

const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const SFD = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SKY = "#4FA3CE";
const BLUE = "#3D8AB0";
const BG = "#EAF5FB";

const TIER_COLORS = {
  "Community Champion": { bg: "#FFF7E6", color: "#92400e", border: "#FDE68A" },
  "Highly Trusted": { bg: BG, color: BLUE, border: "#A8D4EC" },
  Reliable: { bg: BG, color: BLUE, border: "#A8D4EC" },
  "Getting Started": { bg: "#F3F4F6", color: "#5a6470", border: "#D1D5DB" },
  "New Member": { bg: "#F3F4F6", color: "#9ca3af", border: "#E5E7EB" },
};

function ScoreRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const BASE = 65;
  const pct = Math.min(score / BASE, 1);
  const display = Number.isInteger(score)
    ? score
    : score.toFixed(2).replace(/\.?0+$/, "");
  return (
    <svg width="148" height="148" viewBox="0 0 148 148">
      <circle
        cx="74"
        cy="74"
        r={r}
        fill="none"
        stroke="#ececef"
        strokeWidth="10"
      />
      <circle
        cx="74"
        cy="74"
        r={r}
        fill="none"
        stroke={SKY}
        strokeWidth="10"
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 74 74)"
        style={{ transition: "stroke-dasharray 0.7s ease" }}
      />
      <text
        x="74"
        y="70"
        textAnchor="middle"
        style={{
          fontFamily: SFD,
          fontSize: "28px",
          fontWeight: 700,
          fill: "#1d1d1f",
        }}
      >
        {display}
      </text>
      <text
        x="74"
        y="88"
        textAnchor="middle"
        style={{ fontFamily: SF, fontSize: "12px", fill: "#9ca3af" }}
      >
        pts
      </text>
    </svg>
  );
}

function ScoreCard({ data }) {
  const tierStyle = TIER_COLORS[data.tier] ?? TIER_COLORS["New Member"];
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "18px",
        border: "1px solid #e0e0e0",
        padding: "32px 36px",
        display: "flex",
        alignItems: "center",
        gap: "40px",
        marginBottom: "20px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
      }}
    >
      <ScoreRing score={data.totalScore} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: tierStyle.bg,
            color: tierStyle.color,
            border: `1px solid ${tierStyle.border}`,
            borderRadius: "9999px",
            padding: "5px 16px",
            fontSize: "13px",
            fontWeight: 700,
            fontFamily: SF,
            marginBottom: "14px",
          }}
        >
          {data.tier}
        </div>
        <h2
          style={{
            fontFamily: SFD,
            fontSize: "24px",
            fontWeight: 700,
            color: "#1d1d1f",
            margin: "0 0 8px",
            letterSpacing: "-0.3px",
          }}
        >
          {data.totalScore % 1 === 0
            ? data.totalScore
            : data.totalScore.toFixed(2)}{" "}
          pts
        </h2>
        <p
          style={{
            fontFamily: SF,
            fontSize: "14px",
            color: "#7a7a7a",
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {data.totalScore < 3
            ? "Verify your phone and ID, then fill in your profile to unlock your first points."
            : data.totalScore < 15
              ? "Start building relationships with elders to earn rooting points."
              : "Great score — keep completing engagements and earning reviews."}
        </p>
      </div>
    </div>
  );
}

function BasicCard({ basic }) {
  const pct = Math.round((basic.earned / basic.max) * 100);
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "18px",
        border: "1px solid #e0e0e0",
        padding: "28px 32px",
        marginBottom: "16px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: SFD,
              fontSize: "18px",
              fontWeight: 700,
              color: "#1d1d1f",
              margin: "0 0 4px",
            }}
          >
            Profile Score
          </h3>
          <p
            style={{
              fontFamily: SF,
              fontSize: "13px",
              color: "#a0a0a5",
              margin: 0,
            }}
          >
            How completely you've filled in your profile
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontFamily: SFD,
              fontSize: "28px",
              fontWeight: 800,
              color: "#1d1d1f",
            }}
          >
            {basic.earned}
          </span>
          <span style={{ fontFamily: SF, fontSize: "14px", color: "#a0a0a5" }}>
            {" "}
            / {basic.max}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: "8px",
          borderRadius: "9999px",
          background: "#ececef",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: SKY,
            borderRadius: "9999px",
            transition: "width 0.6s ease",
          }}
        />
      </div>

      {/* Field grid */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}
      >
        {basic.fields.map((f) => (
          <div
            key={f.key}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "12px 14px",
              borderRadius: "12px",
              background: f.completed ? BG : "#fafafa",
              border: `1px solid ${f.completed ? "#BFD9EA" : "#f0f0f0"}`,
            }}
          >
            <span style={{ fontSize: "16px", marginTop: "1px" }}>
              {f.completed ? "✓" : "○"}
            </span>
            <div>
              <p
                style={{
                  fontFamily: SF,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: f.completed ? BLUE : "#1d1d1f",
                  margin: "0 0 2px",
                }}
              >
                {f.label}
              </p>
              {!f.completed && f.tip && (
                <p
                  style={{
                    fontFamily: SF,
                    fontSize: "11px",
                    color: "#a0a0a5",
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {f.tip}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RootingCard({ rooting }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "18px",
        border: "1px solid #e0e0e0",
        padding: "28px 32px",
        marginBottom: "16px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: SFD,
              fontSize: "18px",
              fontWeight: 700,
              color: "#1d1d1f",
              margin: "0 0 4px",
            }}
          >
            Rooting Score
          </h3>
          <p
            style={{
              fontFamily: SF,
              fontSize: "13px",
              color: "#a0a0a5",
              margin: 0,
            }}
          >
            Points earned by progressing through trust stages with elders
          </p>
        </div>
        <span
          style={{
            fontFamily: SFD,
            fontSize: "28px",
            fontWeight: 800,
            color: "#1d1d1f",
          }}
        >
          +{rooting.earned}
        </span>
      </div>
      <p
        style={{
          fontFamily: SF,
          fontSize: "14px",
          color: "#7a7a7a",
          margin: "0 0 16px",
        }}
      >
        {rooting.detail}
      </p>
      {/* Stage guide */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {["Text", "Voice", "Video", "In-person", "Help session"].map((s, i) => (
          <span
            key={s}
            style={{
              fontFamily: SF,
              fontSize: "12px",
              fontWeight: 600,
              background: "#f5f5f7",
              color: "#5a6470",
              borderRadius: "9999px",
              padding: "4px 12px",
            }}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>
      {rooting.earned === 0 && (
        <p
          style={{
            fontFamily: SF,
            fontSize: "13px",
            color: SKY,
            margin: "12px 0 0",
          }}
        >
          → Start a connection and send a message to earn your first point.
        </p>
      )}
    </div>
  );
}

function ReviewCard({ review }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "18px",
        border: "1px solid #e0e0e0",
        padding: "28px 32px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: SFD,
              fontSize: "18px",
              fontWeight: 700,
              color: "#1d1d1f",
              margin: "0 0 4px",
            }}
          >
            Review Score
          </h3>
          <p
            style={{
              fontFamily: SF,
              fontSize: "13px",
              color: "#a0a0a5",
              margin: 0,
            }}
          >
            Cumulative sum of all ratings from elders (out of 10 each)
          </p>
        </div>
        <span
          style={{
            fontFamily: SFD,
            fontSize: "28px",
            fontWeight: 800,
            color: "#1d1d1f",
          }}
        >
          +{review.earned}
        </span>
      </div>
      <p
        style={{
          fontFamily: SF,
          fontSize: "14px",
          color: "#7a7a7a",
          margin: 0,
        }}
      >
        {review.detail}
      </p>
      {review.earned === 0 && (
        <p
          style={{
            fontFamily: SF,
            fontSize: "13px",
            color: SKY,
            margin: "12px 0 0",
          }}
        >
          → Complete a help session so an elder can leave you a review.
        </p>
      )}
    </div>
  );
}

export default function Trust() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/trust/my-score")
      .then((r) => setData(r.data))
      .catch(() =>
        setError("Could not load your trust score. Please try again."),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100svh", background: "#fafafc" }}>
      <NavBar />
      <div
        style={{
          maxWidth: "780px",
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontFamily: SFD,
              fontSize: "34px",
              fontWeight: 700,
              color: "#1d1d1f",
              margin: "0 0 8px",
              letterSpacing: "-0.5px",
            }}
          >
            Your Trust Score
          </h1>
          <p
            style={{
              fontFamily: SF,
              fontSize: "16px",
              color: "#7a7a7a",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Three parts: your profile completeness, the depth of your
            relationships, and what elders say about you.
          </p>
        </div>

        {loading && (
          <div
            style={{
              background: "#fff",
              borderRadius: "18px",
              border: "1px solid #e0e0e0",
              padding: "64px",
              textAlign: "center",
              fontFamily: SF,
              fontSize: "15px",
              color: "#a0a0a5",
            }}
          >
            Loading your score…
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "14px",
              padding: "16px 20px",
              fontFamily: SF,
              fontSize: "14px",
              color: "#dc2626",
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <>
            <ScoreCard data={data} />
            <BasicCard basic={data.basic} />
            <RootingCard rooting={data.rooting} />
            <ReviewCard review={data.review} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Start frontend dev server and visually verify**

```bash
cd frontend && npm run dev
# Open http://localhost:5173/trust
# Verify: ScoreCard shows total, BasicCard shows 8 profile fields,
#         RootingCard shows stage points, ReviewCard shows cumulative sum
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Trust.jsx
git commit -m "feat: Trust Score v2 UI — 3-section layout (Profile, Rooting, Reviews)"
```

---

## Final Verification Checklist

- [ ] `./mvnw test -Dtest=TrustScoreServiceTest` → 8 tests, 0 failures
- [ ] `./mvnw compile` → BUILD SUCCESS
- [ ] Restart backend → Flyway applies V17 cleanly (check logs for "Successfully applied")
- [ ] Log in as a helper → GET `/api/trust/my-score` returns `{ totalScore, tier, basic, rooting, review }`
- [ ] `basic.earned` reflects how many profile fields are filled (0.25 per field, max 2.0)
- [ ] `rooting.earned` grows when trust level advances on a connection
- [ ] `review.earned` = sum of ratings (not average)
- [ ] `tier` uses new thresholds: New Member / Getting Started(3) / Reliable(15) / Highly Trusted(50) / Community Champion(120)
- [ ] Profile save (PUT helper profile) triggers recalculate → trust score updates
- [ ] Trust page shows 4 cards: overview + 3 sections, renders cleanly on mobile
