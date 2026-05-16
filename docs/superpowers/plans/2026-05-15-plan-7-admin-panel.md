# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected `/admin` route with a Spring Boot backend and React frontend that lets the admin view/delete all data, approve/reject ID verifications, and suspend/unsuspend users.

**Architecture:** Add `ADMIN` to the `user_role` enum via Flyway V14 migration + seed admin account. New `com.towin.admin` package with `AdminController` + `AdminService` + DTOs. Frontend gets `AdminRoute` guard component and `Admin.jsx` page with 5 tabs.

**Tech Stack:** Spring Boot 3.2.5, Java 21, React + Vite, Tailwind CSS v4, AWS S3 SDK, existing JWT auth.

---

## Chunk 1: Backend Foundation

### Task 1: V14 Migration — Add ADMIN role + seed account

**Files:**
- Create: `backend/src/main/resources/db/migration/V14__add_admin_role.sql`

- [ ] **Step 1: Create migration file**

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN';

INSERT INTO users (id, email, password_hash, role, phone, trust_score, verification_status, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@towin.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  'ADMIN',
  '+10000000001',
  0,
  'NONE',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;
```

The bcrypt hash above is for password `password`. Change it before real deployment by generating a new hash:
```bash
# Generate a bcrypt hash for your chosen password:
htpasswd -bnBC 10 "" yourpassword | tr -d ':\n'
```

- [ ] **Step 2: Add ADMIN to UserRole enum**

File: `backend/src/main/java/com/towin/common/enums/UserRole.java`

```java
public enum UserRole {
    ELDER, HELPER, BOTH, ADMIN
}
```

- [ ] **Step 3: Restart backend and verify migration runs**

```bash
# Restart the backend — Flyway will auto-run V14
# Check logs for:
# "Successfully applied 1 migration to schema "public""
cat /tmp/towin-backend.log | grep -i "flyway\|V14\|migration"
```

- [ ] **Step 4: Verify admin user exists in DB**

```bash
psql "postgresql://postgres:0000@localhost/towin" -c "SELECT email, role FROM users WHERE role = 'ADMIN';"
# Expected: admin@towin.com | ADMIN
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/migration/V14__add_admin_role.sql
git add backend/src/main/java/com/towin/common/enums/UserRole.java
git commit -m "feat: add ADMIN role to user_role enum + seed admin account (V14)"
```

---

### Task 2: Admin DTOs

**Files:**
- Create: `backend/src/main/java/com/towin/admin/dto/AdminUserResponse.java`
- Create: `backend/src/main/java/com/towin/admin/dto/AdminVerificationResponse.java`
- Create: `backend/src/main/java/com/towin/admin/dto/AdminReportResponse.java`
- Create: `backend/src/main/java/com/towin/admin/dto/AdminReviewResponse.java`
- Create: `backend/src/main/java/com/towin/admin/dto/AdminConnectionResponse.java`
- Create: `backend/src/main/java/com/towin/admin/dto/AdminNeedResponse.java`
- Create: `backend/src/main/java/com/towin/admin/dto/AdminMessageResponse.java`

- [ ] **Step 1: Create AdminUserResponse**

```java
package com.towin.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminUserResponse {
    private UUID id;
    private String email;
    private String role;
    private Integer trustScore;
    private String trustTier;
    private Boolean isActive;
    private String verificationStatus;
    private boolean phoneVerified;
    private String photoUrl;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 2: Create AdminVerificationResponse**

```java
package com.towin.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminVerificationResponse {
    private UUID userId;
    private String email;
    private String idDocumentUrl;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 3: Create AdminReportResponse**

```java
package com.towin.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminReportResponse {
    private UUID id;
    private String reporterEmail;
    private String reportedEmail;
    private String reason;
    private String description;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Create AdminReviewResponse**

```java
package com.towin.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminReviewResponse {
    private UUID id;
    private String reviewerEmail;
    private String revieweeEmail;
    private int rating;
    private String[] tags;
    private String comment;
    private boolean safetyConcern;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 5: Create AdminConnectionResponse**

```java
package com.towin.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminConnectionResponse {
    private UUID id;
    private String userAEmail;
    private String userBEmail;
    private String trustLevel;
    private String status;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 6: Create AdminNeedResponse**

```java
package com.towin.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminNeedResponse {
    private UUID id;
    private String elderEmail;
    private String category;
    private String status;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 7: Create AdminMessageResponse**

```java
package com.towin.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data @Builder
public class AdminMessageResponse {
    private UUID id;
    private String senderEmail;
    private UUID connectionId;
    private String content;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/towin/admin/
git commit -m "feat: add admin DTOs"
```

---

### Task 3: AdminService

**Files:**
- Create: `backend/src/main/java/com/towin/admin/AdminService.java`

Dependencies to import: `UserRepository`, `ElderProfileRepository`, `HelperProfileRepository`, `ReviewRepository`, `ReportRepository`, `ConnectionRepository`, `NeedRepository`, `NeedApplicationRepository`, `MessageRepository`, `EmergencyContactRepository`, `TrustProgressionLogRepository`, `S3Service`, `TrustScoreService`

- [ ] **Step 1: Create AdminService with user listing and suspend/unsuspend**

```java
package com.towin.admin;

import com.towin.admin.dto.*;
import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.common.service.S3Service;
import com.towin.common.service.TrustScoreService;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.emergency.repository.EmergencyContactRepository;
import com.towin.message.repository.MessageRepository;
import com.towin.need.repository.NeedApplicationRepository;
import com.towin.need.repository.NeedRepository;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import com.towin.report.repository.ReportRepository;
import com.towin.review.repository.ReviewRepository;
import com.towin.trust.repository.TrustProgressionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ReviewRepository reviewRepository;
    private final ReportRepository reportRepository;
    private final ConnectionRepository connectionRepository;
    private final NeedRepository needRepository;
    private final NeedApplicationRepository needApplicationRepository;
    private final MessageRepository messageRepository;
    private final EmergencyContactRepository emergencyContactRepository;
    private final TrustProgressionLogRepository trustProgressionLogRepository;
    private final S3Service s3Service;
    private final TrustScoreService trustScoreService;

    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(u -> AdminUserResponse.builder()
                        .id(u.getId())
                        .email(u.getEmail())
                        .role(u.getRole().name())
                        .trustScore(u.getTrustScore())
                        .trustTier(TrustScoreService.tierFor(u.getTrustScore() != null ? u.getTrustScore() : 0))
                        .isActive(u.getIsActive())
                        .verificationStatus(u.getVerificationStatus().name())
                        .phoneVerified(u.isPhoneVerified())
                        .photoUrl(getPhotoUrl(u.getId()))
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    private String getPhotoUrl(UUID userId) {
        var elder = elderProfileRepository.findByUserId(userId).orElse(null);
        if (elder != null) return elder.getPhotoUrl();
        var helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null) return helper.getPhotoUrl();
        return null;
    }

    @Transactional
    public void suspendUser(UUID userId) {
        User user = getUser(userId);
        user.setIsActive(false);
        userRepository.save(user);
    }

    @Transactional
    public void unsuspendUser(UUID userId) {
        User user = getUser(userId);
        user.setIsActive(true);
        userRepository.save(user);
    }

    @Transactional
    public void deleteUserPhoto(UUID userId) {
        var elder = elderProfileRepository.findByUserId(userId).orElse(null);
        if (elder != null && elder.getPhotoUrl() != null) {
            s3Service.deleteFile(elder.getPhotoUrl());
            elder.setPhotoUrl(null);
            elderProfileRepository.save(elder);
            return;
        }
        var helper = helperProfileRepository.findByUserId(userId).orElse(null);
        if (helper != null && helper.getPhotoUrl() != null) {
            s3Service.deleteFile(helper.getPhotoUrl());
            helper.setPhotoUrl(null);
            helperProfileRepository.save(helper);
        }
    }

    @Transactional
    public void deleteUser(UUID adminId, UUID userId) {
        if (adminId.equals(userId)) {
            throw new IllegalArgumentException("Cannot delete your own admin account");
        }
        User user = getUser(userId);

        // Delete S3 files
        String photoUrl = getPhotoUrl(userId);
        if (photoUrl != null) s3Service.deleteFile(photoUrl);
        if (user.getIdDocumentUrl() != null) s3Service.deleteFile(user.getIdDocumentUrl());

        // Delete in dependency order
        messageRepository.deleteByConnectionUserIdOrSenderId(userId);
        reviewRepository.deleteByReviewerIdOrRevieweeId(userId, userId);
        reportRepository.deleteByReporterIdOrReportedUserId(userId, userId);
        needApplicationRepository.deleteByHelperId(userId);
        needRepository.deleteByElderId(userId);
        emergencyContactRepository.deleteByElderId(userId);
        trustProgressionLogRepository.deleteByUserId(userId);
        connectionRepository.deleteByUserId(userId);
        elderProfileRepository.deleteByUserId(userId);
        helperProfileRepository.deleteByUserId(userId);
        userRepository.delete(user);
    }

    // Verifications
    public List<AdminVerificationResponse> getPendingVerifications() {
        return userRepository.findByVerificationStatus(com.towin.common.enums.VerificationStatus.PENDING)
                .stream()
                .map(u -> AdminVerificationResponse.builder()
                        .userId(u.getId())
                        .email(u.getEmail())
                        .idDocumentUrl(u.getIdDocumentUrl())
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void approveVerification(UUID userId) {
        User user = getUser(userId);
        user.setVerificationStatus(com.towin.common.enums.VerificationStatus.VERIFIED);
        userRepository.save(user);
        trustScoreService.recalculate(userId);
    }

    @Transactional
    public void rejectVerification(UUID userId) {
        User user = getUser(userId);
        if (user.getIdDocumentUrl() != null) {
            s3Service.deleteFile(user.getIdDocumentUrl());
            user.setIdDocumentUrl(null);
        }
        user.setVerificationStatus(com.towin.common.enums.VerificationStatus.REJECTED);
        userRepository.save(user);
    }

    // Reports
    public List<AdminReportResponse> getAllReports() {
        return reportRepository.findAllWithUsers().stream()
                .map(r -> AdminReportResponse.builder()
                        .id(r.getId())
                        .reporterEmail(r.getReporter().getEmail())
                        .reportedEmail(r.getReportedUser().getEmail())
                        .reason(r.getReason())
                        .description(r.getDescription())
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteReport(UUID reportId) {
        reportRepository.deleteById(reportId);
    }

    // Reviews
    public List<AdminReviewResponse> getAllReviews(boolean safetyConcernOnly) {
        var reviews = safetyConcernOnly
                ? reviewRepository.findBySafetyConcernTrue()
                : reviewRepository.findAll();
        return reviews.stream()
                .map(r -> AdminReviewResponse.builder()
                        .id(r.getId())
                        .reviewerEmail(r.getReviewer().getEmail())
                        .revieweeEmail(r.getReviewee().getEmail())
                        .rating(r.getRating())
                        .tags(r.getTags())
                        .comment(r.getComment())
                        .safetyConcern(r.isSafetyConcern())
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteReview(UUID reviewId) {
        reviewRepository.deleteById(reviewId);
    }

    // Connections
    public List<AdminConnectionResponse> getAllConnections() {
        return connectionRepository.findAll().stream()
                .map(c -> AdminConnectionResponse.builder()
                        .id(c.getId())
                        .userAEmail(c.getUserA().getEmail())
                        .userBEmail(c.getUserB().getEmail())
                        .trustLevel(c.getCurrentTrustLevel().name())
                        .status(c.getStatus().name())
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteConnection(UUID connectionId) {
        trustProgressionLogRepository.deleteByConnectionId(connectionId);
        messageRepository.deleteByConnectionId(connectionId);
        connectionRepository.deleteById(connectionId);
    }

    // Needs
    public List<AdminNeedResponse> getAllNeeds() {
        return needRepository.findAll().stream()
                .map(n -> AdminNeedResponse.builder()
                        .id(n.getId())
                        .elderEmail(n.getElder().getEmail())
                        .category(n.getCategory().name())
                        .status(n.getStatus().name())
                        .createdAt(n.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteNeed(UUID needId) {
        needApplicationRepository.deleteByNeedId(needId);
        needRepository.deleteById(needId);
    }

    // Messages
    public List<AdminMessageResponse> getAllMessages() {
        return messageRepository.findAll().stream()
                .map(m -> AdminMessageResponse.builder()
                        .id(m.getId())
                        .senderEmail(m.getSender().getEmail())
                        .connectionId(m.getConnection().getId())
                        .content(m.getContent())
                        .createdAt(m.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteMessage(UUID messageId) {
        messageRepository.deleteById(messageId);
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/java/com/towin/admin/AdminService.java
git commit -m "feat: add AdminService with full CRUD + hard delete cascade"
```

---

### Task 4: Repository additions

**Files:**
- Modify: `backend/src/main/java/com/towin/common/repository/UserRepository.java`
- Modify: `backend/src/main/java/com/towin/report/repository/ReportRepository.java`
- Modify: `backend/src/main/java/com/towin/review/repository/ReviewRepository.java`
- Modify: `backend/src/main/java/com/towin/message/repository/MessageRepository.java`
- Modify: `backend/src/main/java/com/towin/need/repository/NeedRepository.java`
- Modify: `backend/src/main/java/com/towin/need/repository/NeedApplicationRepository.java`
- Modify: `backend/src/main/java/com/towin/connection/repository/ConnectionRepository.java`
- Modify: `backend/src/main/java/com/towin/trust/repository/TrustProgressionLogRepository.java`
- Modify: `backend/src/main/java/com/towin/emergency/repository/EmergencyContactRepository.java`
- Modify: `backend/src/main/java/com/towin/profile/repository/ElderProfileRepository.java`
- Modify: `backend/src/main/java/com/towin/profile/repository/HelperProfileRepository.java`

- [ ] **Step 1: Add to UserRepository**

```java
List<User> findByVerificationStatus(VerificationStatus status);
```

- [ ] **Step 2: Add to ReportRepository**

```java
@Query("SELECT r FROM Report r JOIN FETCH r.reporter JOIN FETCH r.reportedUser")
List<Report> findAllWithUsers();

void deleteByReporterIdOrReportedUserId(UUID reporterId, UUID reportedUserId);
```

- [ ] **Step 3: Add to ReviewRepository**

```java
List<Review> findBySafetyConcernTrue();
void deleteByReviewerIdOrRevieweeId(UUID reviewerId, UUID revieweeId);
```

- [ ] **Step 4: Add to MessageRepository**

```java
@Modifying
@Query("DELETE FROM Message m WHERE m.connection.id = :connectionId")
void deleteByConnectionId(@Param("connectionId") UUID connectionId);

@Modifying
@Query("DELETE FROM Message m WHERE m.sender.id = :userId OR m.connection.userA.id = :userId OR m.connection.userB.id = :userId")
void deleteByConnectionUserIdOrSenderId(@Param("userId") UUID userId);
```

- [ ] **Step 5: Add to NeedRepository**

```java
@Modifying
@Query("DELETE FROM Need n WHERE n.elder.id = :elderId")
void deleteByElderId(@Param("elderId") UUID elderId);
```

- [ ] **Step 6: Add to NeedApplicationRepository**

```java
@Modifying
@Query("DELETE FROM NeedApplication a WHERE a.helper.id = :helperId")
void deleteByHelperId(@Param("helperId") UUID helperId);

@Modifying
@Query("DELETE FROM NeedApplication a WHERE a.need.id = :needId")
void deleteByNeedId(@Param("needId") UUID needId);
```

- [ ] **Step 7: Add to ConnectionRepository**

```java
@Modifying
@Query("DELETE FROM Connection c WHERE c.userA.id = :userId OR c.userB.id = :userId")
void deleteByUserId(@Param("userId") UUID userId);
```

- [ ] **Step 8: Add to TrustProgressionLogRepository**

```java
@Modifying
@Query("DELETE FROM TrustProgressionLog t WHERE t.connection.id = :connectionId")
void deleteByConnectionId(@Param("connectionId") UUID connectionId);

@Modifying
@Query("DELETE FROM TrustProgressionLog t WHERE t.confirmedBy.id = :userId")
void deleteByUserId(@Param("userId") UUID userId);
```

- [ ] **Step 9: Add to EmergencyContactRepository**

```java
@Modifying
@Query("DELETE FROM EmergencyContact e WHERE e.elder.id = :elderId")
void deleteByElderId(@Param("elderId") UUID elderId);
```

- [ ] **Step 10: Add to ElderProfileRepository and HelperProfileRepository**

```java
// ElderProfileRepository
void deleteByUserId(UUID userId);

// HelperProfileRepository
void deleteByUserId(UUID userId);
```

- [ ] **Step 11: Commit**

```bash
git add backend/src/main/java/com/towin/
git commit -m "feat: add admin delete/query methods to repositories"
```

---

### Task 5: S3Service — add deleteFile method

**Files:**
- Modify: `backend/src/main/java/com/towin/common/service/S3Service.java`

- [ ] **Step 1: Add deleteFile method**

Add this method to `S3Service.java`:

```java
public void deleteFile(String url) {
    if (url == null || url.isBlank()) return;
    try {
        // Extract key from URL: https://bucket.s3.region.amazonaws.com/key
        String key = url.substring(url.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
        s3Client.deleteObject(b -> b.bucket(bucket).key(key));
    } catch (Exception e) {
        // Log but don't throw — file may already be deleted
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/java/com/towin/common/service/S3Service.java
git commit -m "feat: add S3Service.deleteFile"
```

---

### Task 6: AdminController + SecurityConfig

**Files:**
- Create: `backend/src/main/java/com/towin/admin/AdminController.java`
- Modify: `backend/src/main/java/com/towin/common/security/SecurityConfig.java`

- [ ] **Step 1: Create AdminController**

```java
package com.towin.admin;

import com.towin.admin.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins:http://localhost:5173}")
public class AdminController {

    private final AdminService adminService;

    // Users
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> getUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(Authentication auth, @PathVariable UUID id) {
        UUID adminId = UUID.fromString(auth.getName());
        adminService.deleteUser(adminId, id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{id}/suspend")
    public ResponseEntity<Void> suspendUser(@PathVariable UUID id) {
        adminService.suspendUser(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/users/{id}/unsuspend")
    public ResponseEntity<Void> unsuspendUser(@PathVariable UUID id) {
        adminService.unsuspendUser(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/users/{id}/photo")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID id) {
        adminService.deleteUserPhoto(id);
        return ResponseEntity.ok().build();
    }

    // Verifications
    @GetMapping("/verifications")
    public ResponseEntity<List<AdminVerificationResponse>> getVerifications() {
        return ResponseEntity.ok(adminService.getPendingVerifications());
    }

    @PutMapping("/verifications/{id}/approve")
    public ResponseEntity<Void> approveVerification(@PathVariable UUID id) {
        adminService.approveVerification(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/verifications/{id}/reject")
    public ResponseEntity<Void> rejectVerification(@PathVariable UUID id) {
        adminService.rejectVerification(id);
        return ResponseEntity.ok().build();
    }

    // Reports
    @GetMapping("/reports")
    public ResponseEntity<List<AdminReportResponse>> getReports() {
        return ResponseEntity.ok(adminService.getAllReports());
    }

    @DeleteMapping("/reports/{id}")
    public ResponseEntity<Void> deleteReport(@PathVariable UUID id) {
        adminService.deleteReport(id);
        return ResponseEntity.ok().build();
    }

    // Reviews
    @GetMapping("/reviews")
    public ResponseEntity<List<AdminReviewResponse>> getReviews(
            @RequestParam(defaultValue = "false") boolean safetyOnly) {
        return ResponseEntity.ok(adminService.getAllReviews(safetyOnly));
    }

    @DeleteMapping("/reviews/{id}")
    public ResponseEntity<Void> deleteReview(@PathVariable UUID id) {
        adminService.deleteReview(id);
        return ResponseEntity.ok().build();
    }

    // Connections
    @GetMapping("/connections")
    public ResponseEntity<List<AdminConnectionResponse>> getConnections() {
        return ResponseEntity.ok(adminService.getAllConnections());
    }

    @DeleteMapping("/connections/{id}")
    public ResponseEntity<Void> deleteConnection(@PathVariable UUID id) {
        adminService.deleteConnection(id);
        return ResponseEntity.ok().build();
    }

    // Needs
    @GetMapping("/needs")
    public ResponseEntity<List<AdminNeedResponse>> getNeeds() {
        return ResponseEntity.ok(adminService.getAllNeeds());
    }

    @DeleteMapping("/needs/{id}")
    public ResponseEntity<Void> deleteNeed(@PathVariable UUID id) {
        adminService.deleteNeed(id);
        return ResponseEntity.ok().build();
    }

    // Messages
    @GetMapping("/messages")
    public ResponseEntity<List<AdminMessageResponse>> getMessages() {
        return ResponseEntity.ok(adminService.getAllMessages());
    }

    @DeleteMapping("/messages/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable UUID id) {
        adminService.deleteMessage(id);
        return ResponseEntity.ok().build();
    }
}
```

- [ ] **Step 2: Update SecurityConfig — add admin role restriction**

In `SecurityConfig.java`, update the `authorizeHttpRequests` block:

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/api/auth/**").permitAll()
    .requestMatchers("/ws/**").permitAll()
    .requestMatchers("/api/admin/**").hasAuthority("ADMIN")
    .anyRequest().authenticated()
)
```

- [ ] **Step 3: Make sure JwtAuthFilter sets the authority correctly**

Open `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java`. Find where `UsernamePasswordAuthenticationToken` is created and verify it includes the role as a `SimpleGrantedAuthority`. It should look like:

```java
var authorities = List.of(new SimpleGrantedAuthority(role));
var authToken = new UsernamePasswordAuthenticationToken(userId, null, authorities);
```

If role is not being passed as an authority, add it. Check the JwtUtil to see what claims are stored.

- [ ] **Step 4: Restart backend and test admin login**

```bash
# Restart backend
pkill -f "spring-boot:run"
cd backend && export $(grep -v '^#' ../.env | xargs) && ./mvnw spring-boot:run -q > /tmp/towin-backend.log 2>&1 &

# Test login
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@towin.com","password":"password"}' | python3 -m json.tool
# Expected: { "token": "...", "role": "ADMIN", ... }
```

- [ ] **Step 5: Test admin endpoint is protected**

```bash
# Without token — should return 401/403
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/admin/users
# Expected: 401 or 403

# With admin token — should return 200
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@towin.com","password":"password"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/admin/users
# Expected: 200
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/towin/admin/AdminController.java
git add backend/src/main/java/com/towin/common/security/SecurityConfig.java
git commit -m "feat: add AdminController + secure /api/admin/** with ADMIN role"
```

---

## Chunk 2: Frontend

### Task 7: AdminRoute guard + App.jsx wiring

**Files:**
- Create: `frontend/src/components/AdminRoute.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/context/AuthContext.jsx` (Login redirect)
- Modify: `frontend/src/pages/Login.jsx` (redirect ADMIN to /admin)

- [ ] **Step 1: Create AdminRoute component**

```jsx
// frontend/src/components/AdminRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return children;
}
```

- [ ] **Step 2: Add /admin route to App.jsx**

Add import at top:
```jsx
import Admin from './pages/Admin';
import AdminRoute from './components/AdminRoute';
```

Add route inside `<Routes>`:
```jsx
<Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
```

- [ ] **Step 3: Update Login.jsx to redirect ADMIN to /admin**

In `Login.jsx`, update the `handleSubmit` success handler:

```jsx
login(data.token, data.role, data.userId);
if (data.role === 'ADMIN') {
  navigate('/admin');
} else {
  navigate('/dashboard');
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AdminRoute.jsx frontend/src/App.jsx frontend/src/pages/Login.jsx
git commit -m "feat: add AdminRoute guard + /admin route + admin login redirect"
```

---

### Task 8: Admin.jsx — full admin panel page

**Files:**
- Create: `frontend/src/pages/Admin.jsx`

- [ ] **Step 1: Create Admin.jsx**

```jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const TABS = ['Users', 'Verifications', 'Reports', 'Reviews', 'Data'];
const DATA_TABS = ['Connections', 'Needs', 'Messages'];

function ConfirmButton({ label, className, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex gap-1">
        <button onClick={() => { onConfirm(); setConfirming(false); }}
          className="text-xs bg-red-600 text-white px-2 py-1 rounded">Sure?</button>
        <button onClick={() => setConfirming(false)}
          className="text-xs bg-gray-300 px-2 py-1 rounded">No</button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className={className}>{label}</button>
  );
}

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Users');
  const [dataTab, setDataTab] = useState('Connections');

  const [users, setUsers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [safetyOnly, setSafetyOnly] = useState(false);
  const [connections, setConnections] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [messages, setMessages] = useState([]);

  useEffect(() => { fetchTab(tab); }, [tab]);
  useEffect(() => { if (tab === 'Reviews') fetchReviews(); }, [safetyOnly]);
  useEffect(() => { if (tab === 'Data') fetchDataTab(dataTab); }, [dataTab]);

  async function fetchTab(t) {
    if (t === 'Users') { const r = await api.get('/admin/users'); setUsers(r.data); }
    if (t === 'Verifications') { const r = await api.get('/admin/verifications'); setVerifications(r.data); }
    if (t === 'Reports') { const r = await api.get('/admin/reports'); setReports(r.data); }
    if (t === 'Reviews') fetchReviews();
    if (t === 'Data') fetchDataTab(dataTab);
  }

  async function fetchReviews() {
    const r = await api.get(`/admin/reviews?safetyOnly=${safetyOnly}`);
    setReviews(r.data);
  }

  async function fetchDataTab(dt) {
    if (dt === 'Connections') { const r = await api.get('/admin/connections'); setConnections(r.data); }
    if (dt === 'Needs') { const r = await api.get('/admin/needs'); setNeeds(r.data); }
    if (dt === 'Messages') { const r = await api.get('/admin/messages'); setMessages(r.data); }
  }

  const btn = 'text-xs px-2 py-1 rounded';
  const red = `${btn} bg-red-100 text-red-700 hover:bg-red-200`;
  const green = `${btn} bg-green-100 text-green-700 hover:bg-green-200`;
  const yellow = `${btn} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`;
  const gray = `${btn} bg-gray-100 text-gray-600 hover:bg-gray-200`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-gray-800">ToWin Admin</h1>
        <button onClick={() => { logout(); navigate('/login'); }}
          className="text-xs text-gray-500 hover:text-red-500">Logout</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white px-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Users Tab */}
        {tab === 'Users' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Email','Role','Score','Tier','Active','Verified','Joined','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3">{u.trustScore}</td>
                    <td className="px-4 py-3">{u.trustTier}</td>
                    <td className="px-4 py-3">{u.isActive ? '✅' : '🚫'}</td>
                    <td className="px-4 py-3">{u.verificationStatus}</td>
                    <td className="px-4 py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.isActive
                          ? <button onClick={() => api.put(`/admin/users/${u.id}/suspend`).then(() => fetchTab('Users'))} className={yellow}>Suspend</button>
                          : <button onClick={() => api.put(`/admin/users/${u.id}/unsuspend`).then(() => fetchTab('Users'))} className={green}>Unsuspend</button>
                        }
                        {u.photoUrl && (
                          <ConfirmButton label="Del Photo" className={gray}
                            onConfirm={() => api.delete(`/admin/users/${u.id}/photo`).then(() => fetchTab('Users'))} />
                        )}
                        <ConfirmButton label="Delete" className={red}
                          onConfirm={() => api.delete(`/admin/users/${u.id}`).then(() => fetchTab('Users'))} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Verifications Tab */}
        {tab === 'Verifications' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {verifications.length === 0 && <p className="px-6 py-8 text-gray-400 text-sm">No pending verifications.</p>}
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Email','ID Document','Submitted','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {verifications.map(v => (
                  <tr key={v.userId}>
                    <td className="px-4 py-3">{v.email}</td>
                    <td className="px-4 py-3">
                      {v.idDocumentUrl
                        ? <a href={v.idDocumentUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline text-xs">View Document</a>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{new Date(v.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 flex gap-1">
                      <button onClick={() => api.put(`/admin/verifications/${v.userId}/approve`).then(() => fetchTab('Verifications'))} className={green}>✓ Approve</button>
                      <ConfirmButton label="✗ Reject" className={red}
                        onConfirm={() => api.put(`/admin/verifications/${v.userId}/reject`).then(() => fetchTab('Verifications'))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reports Tab */}
        {tab === 'Reports' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {reports.length === 0 && <p className="px-6 py-8 text-gray-400 text-sm">No reports.</p>}
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Reporter','Reported','Reason','Description','Date','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{r.reporterEmail}</td>
                    <td className="px-4 py-3">{r.reportedEmail}</td>
                    <td className="px-4 py-3">{r.reason}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{r.description}</td>
                    <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <ConfirmButton label="Delete" className={red}
                        onConfirm={() => api.delete(`/admin/reports/${r.id}`).then(() => fetchTab('Reports'))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reviews Tab */}
        {tab === 'Reviews' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setSafetyOnly(false)} className={!safetyOnly ? 'text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-sm text-gray-500'}>All Reviews</button>
              <button onClick={() => setSafetyOnly(true)} className={safetyOnly ? 'text-sm font-medium text-red-600 border-b-2 border-red-600 pb-1' : 'text-sm text-gray-500'}>⚠ Safety Flags</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {reviews.length === 0 && <p className="px-6 py-8 text-gray-400 text-sm">No reviews.</p>}
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>{['Reviewer','Reviewee','Rating','Tags','Safety','Date','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviews.map(r => (
                    <tr key={r.id} className={r.safetyConcern ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3">{r.reviewerEmail}</td>
                      <td className="px-4 py-3">{r.revieweeEmail}</td>
                      <td className="px-4 py-3">{'★'.repeat(r.rating)}</td>
                      <td className="px-4 py-3">{r.tags?.join(', ')}</td>
                      <td className="px-4 py-3">{r.safetyConcern ? '⚠️' : '—'}</td>
                      <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <ConfirmButton label="Delete" className={red}
                          onConfirm={() => api.delete(`/admin/reviews/${r.id}`).then(fetchReviews)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {tab === 'Data' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {DATA_TABS.map(dt => (
                <button key={dt} onClick={() => setDataTab(dt)}
                  className={dataTab === dt ? 'text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-sm text-gray-500'}>
                  {dt}
                </button>
              ))}
            </div>

            {dataTab === 'Connections' && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['User A','User B','Trust Level','Status','Created','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {connections.map(c => (
                      <tr key={c.id}>
                        <td className="px-4 py-3">{c.userAEmail}</td>
                        <td className="px-4 py-3">{c.userBEmail}</td>
                        <td className="px-4 py-3">{c.trustLevel}</td>
                        <td className="px-4 py-3">{c.status}</td>
                        <td className="px-4 py-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <ConfirmButton label="Delete" className={red}
                            onConfirm={() => api.delete(`/admin/connections/${c.id}`).then(() => fetchDataTab('Connections'))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dataTab === 'Needs' && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Elder','Category','Status','Created','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {needs.map(n => (
                      <tr key={n.id}>
                        <td className="px-4 py-3">{n.elderEmail}</td>
                        <td className="px-4 py-3">{n.category}</td>
                        <td className="px-4 py-3">{n.status}</td>
                        <td className="px-4 py-3">{new Date(n.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <ConfirmButton label="Delete" className={red}
                            onConfirm={() => api.delete(`/admin/needs/${n.id}`).then(() => fetchDataTab('Needs'))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dataTab === 'Messages' && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>{['Sender','Content','Date','Actions'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {messages.map(m => (
                      <tr key={m.id}>
                        <td className="px-4 py-3">{m.senderEmail}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{m.content}</td>
                        <td className="px-4 py-3">{new Date(m.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <ConfirmButton label="Delete" className={red}
                            onConfirm={() => api.delete(`/admin/messages/${m.id}`).then(() => fetchDataTab('Messages'))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Admin.jsx
git commit -m "feat: add Admin panel page with 5 tabs"
```

---

### Task 9: End-to-end test + final commit

- [ ] **Step 1: Restart backend**

```bash
pkill -f "spring-boot:run"
cd /Users/aghar/Documents/Projects/ToWin/backend
export $(grep -v '^#' ../.env | xargs)
./mvnw spring-boot:run -q > /tmp/towin-backend.log 2>&1 &
until curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"x","password":"x"}' | grep -q "400\|401"; do sleep 3; done && echo "Up"
```

- [ ] **Step 2: Test admin login in browser**

1. Open http://localhost:5173/login
2. Login with `admin@towin.com` / `password`
3. Should redirect to http://localhost:5173/admin
4. Should see 5 tabs: Users | Verifications | Reports | Reviews | Data

- [ ] **Step 3: Test Users tab**

1. Click **Users** tab — should see all users listed
2. Click **Suspend** on a test user — should flip to 🚫
3. Click **Unsuspend** — should flip back to ✅

- [ ] **Step 4: Test Verifications tab**

1. Upload an ID doc as elder@gmail.com in ProfileEdit
2. Come back to admin → Verifications tab
3. Click **✓ Approve** — user should disappear from list
4. Check in Users tab that user's verificationStatus = VERIFIED

- [ ] **Step 5: Test Data tab**

1. Click Data → Connections — should list connections
2. Delete a connection — should disappear

- [ ] **Step 6: Final commit and push**

```bash
git add -A
git commit -m "feat: admin panel — users, verifications, reports, reviews, data tables (Plan 7)"
git push origin plan-5/reviews-trust-reports
```

- [ ] **Step 7: Update plan doc status**

In `notes/steps.md`, add Plan 7 entry.
