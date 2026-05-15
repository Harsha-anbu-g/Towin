# Plan 6 — Verification + Platform Polish

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Complete

**Goal:** Wire phone/ID verification (so +10/+20 trust score factors actually fire), track lastSeenAt on every request, add SOS to NavBar, add inactivity SMS detection, and add trust-level banners in the Messages page.

**Architecture:** Backend changes are additive — new endpoints on AuthController, a scheduled service for inactivity, and a single JwtAuthFilter tweak for lastSeenAt. Frontend changes are all in existing pages (NavBar, Messages). One V13 Flyway migration covers all new columns.

**Tech Stack:** Spring Boot 3.2.5, Java 21, Flyway, Twilio SDK (already in pom.xml), S3Service (already exists), React + Axios

---

## File Map

**New files:**
- `backend/.../resources/db/migration/V13__add_verification_columns.sql`
- `backend/.../auth/dto/PhoneOtpRequest.java`
- `backend/.../auth/dto/PhoneVerifyRequest.java`
- `backend/.../emergency/service/InactivityCheckService.java`

**Modified files:**
- `backend/.../common/entity/User.java` — add phoneOtp, phoneOtpExpiresAt, inactivityAlertedAt fields
- `backend/.../common/security/JwtAuthFilter.java` — update lastSeenAt on each authenticated request
- `backend/.../auth/service/AuthService.java` — add verifyId, requestPhoneOtp, confirmPhoneOtp methods
- `backend/.../auth/controller/AuthController.java` — add 3 new endpoints
- `backend/.../common/config/SchedulingConfig.java` (new) — @EnableScheduling
- `frontend/src/components/NavBar.jsx` — SOS button for elders
- `frontend/src/pages/Messages.jsx` — trust-level banner

---

## Task 1 — V13 Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V13__add_verification_columns.sql`

- [ ] Create the migration file:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_otp VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_otp_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS inactivity_alerted_at TIMESTAMP;
```

- [ ] Add matching fields to `User.java` (`backend/src/main/java/com/towin/common/entity/User.java`):

```java
@Column(name = "phone_otp")
private String phoneOtp;

@Column(name = "phone_otp_expires_at")
private LocalDateTime phoneOtpExpiresAt;

@Column(name = "inactivity_alerted_at")
private LocalDateTime inactivityAlertedAt;
```

- [ ] Verify the app starts cleanly (Flyway applies V13, JPA validates OK):
```
./mvnw spring-boot:run
# Check logs: "Successfully applied 1 migration" and no "Schema-validation" errors
```

- [ ] Commit:
```bash
git add backend/src/main/resources/db/migration/V13__add_verification_columns.sql \
        backend/src/main/java/com/towin/common/entity/User.java
git commit -m "feat: V13 migration — phone OTP + inactivity columns"
```

---

## Task 2 — lastSeenAt tracking in JwtAuthFilter

**Files:**
- Modify: `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java`

The filter already has `userId` at the point of authentication. Inject `UserRepository` lazily (to avoid a circular dependency through `SecurityConfig`) and update `lastSeenAt` asynchronously.

- [ ] Update `JwtAuthFilter.java`:

```java
package com.towin.common.security;

import com.towin.auth.security.JwtUtil;
import com.towin.common.repository.UserRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final ApplicationContext ctx;   // lazy access to avoid circular dep

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.isTokenValid(token)) {
                String userId = jwtUtil.extractUserId(token).orElse(null);
                if (userId != null) {
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(
                                    userId, null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    updateLastSeen(userId);
                }
            }
        }
        chain.doFilter(request, response);
    }

    private void updateLastSeen(String userId) {
        try {
            UserRepository repo = ctx.getBean(UserRepository.class);
            repo.findById(UUID.fromString(userId)).ifPresent(user -> {
                user.setLastSeenAt(LocalDateTime.now());
                repo.save(user);
            });
        } catch (Exception ignored) {
            // never block the request for a lastSeenAt update
        }
    }
}
```

- [ ] Commit:
```bash
git add backend/src/main/java/com/towin/common/security/JwtAuthFilter.java
git commit -m "feat: update lastSeenAt on every authenticated request"
```

---

## Task 3 — SOS button in NavBar

**Files:**
- Modify: `frontend/src/components/NavBar.jsx`

The SOS endpoint `POST /api/emergency/sos` already exists. Add a red button that calls it with one tap.

- [ ] Update `NavBar.jsx` — add `sosSent` state and SOS button for elders:

```jsx
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [sosSent, setSosSent] = useState(false);
  const [sending, setSending] = useState(false);

  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';
  const isHelper = user?.role === 'HELPER' || user?.role === 'BOTH';

  const link = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        pathname === to
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );

  async function triggerSos() {
    setSending(true);
    try {
      await api.post('/emergency/sos');
      setSosSent(true);
      setTimeout(() => setSosSent(false), 5000);
    } catch {
      alert('Could not send SOS. Please call emergency services directly.');
    } finally {
      setSending(false);
    }
  }

  return (
    <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="text-lg font-bold text-indigo-700">ToWin</Link>
        <div className="flex items-center gap-1">
          {link('/dashboard', 'Dashboard')}
          {link('/profile', 'Profile')}
          {isElder && link('/emergency-contacts', 'Emergency Contacts')}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isElder && (
          <button
            onClick={triggerSos}
            disabled={sending}
            className={`text-sm font-bold px-4 py-1.5 rounded-full transition-colors ${
              sosSent
                ? 'bg-green-500 text-white'
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
            } disabled:opacity-50`}
          >
            {sosSent ? '✓ Help sent' : sending ? '...' : '🆘 SOS'}
          </button>
        )}
        <button onClick={logout} className="text-sm text-red-500 hover:underline">
          Sign out
        </button>
      </div>
    </nav>
  );
}
```

- [ ] Commit:
```bash
git add frontend/src/components/NavBar.jsx
git commit -m "feat: add SOS button to NavBar for elder users"
```

---

## Task 4 — Inactivity detection scheduled task

**Files:**
- Create: `backend/src/main/java/com/towin/emergency/service/InactivityCheckService.java`
- Create: `backend/src/main/java/com/towin/common/config/SchedulingConfig.java`
- Modify: `backend/src/main/java/com/towin/common/repository/UserRepository.java` — add query for inactive elders

**Logic:**
- Run daily at 09:00
- Find all elder/both users where `lastSeenAt < now - 5 days` (or null and `createdAt < now - 5 days`)
  AND `(inactivityAlertedAt IS NULL OR inactivityAlertedAt < now - 7 days)`
- For each such user, SMS all their emergency contacts
- Update `user.inactivityAlertedAt = now`

- [ ] Create `SchedulingConfig.java`:

```java
package com.towin.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class SchedulingConfig {}
```

- [ ] Add JPQL query to `UserRepository.java`:

```java
@Query("""
    SELECT u FROM User u
    WHERE (u.role = com.towin.common.enums.UserRole.ELDER
           OR u.role = com.towin.common.enums.UserRole.BOTH)
      AND u.isActive = true
      AND (
            (u.lastSeenAt IS NOT NULL AND u.lastSeenAt < :cutoff)
            OR (u.lastSeenAt IS NULL AND u.createdAt < :cutoff)
          )
      AND (u.inactivityAlertedAt IS NULL OR u.inactivityAlertedAt < :alertCutoff)
    """)
List<User> findInactiveElders(
    @Param("cutoff") LocalDateTime cutoff,
    @Param("alertCutoff") LocalDateTime alertCutoff);
```

Add required imports: `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`, `java.time.LocalDateTime`, `java.util.List`.

- [ ] Create `InactivityCheckService.java`:

```java
package com.towin.emergency.service;

import com.towin.common.entity.User;
import com.towin.common.repository.UserRepository;
import com.towin.emergency.entity.EmergencyContact;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InactivityCheckService {

    private final UserRepository userRepository;
    private final EmergencyContactService contactService;
    private final SosService sosService;

    private static final int INACTIVITY_DAYS = 5;
    private static final int ALERT_COOLDOWN_DAYS = 7;

    @Scheduled(cron = "0 0 9 * * *")   // 09:00 every day
    @Transactional
    public void checkInactiveElders() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(INACTIVITY_DAYS);
        LocalDateTime alertCutoff = LocalDateTime.now().minusDays(ALERT_COOLDOWN_DAYS);

        List<User> inactiveElders = userRepository.findInactiveElders(cutoff, alertCutoff);
        log.info("Inactivity check: {} elder(s) to notify", inactiveElders.size());

        for (User elder : inactiveElders) {
            try {
                List<EmergencyContact> contacts = contactService.getContactEntities(elder.getId());
                contacts.forEach(c -> sosService.sendInactivityAlert(c.getPhone(), elder));
                elder.setInactivityAlertedAt(LocalDateTime.now());
                userRepository.save(elder);
                log.info("Inactivity alert sent for elder {}", elder.getId());
            } catch (Exception e) {
                log.error("Failed to alert for elder {}: {}", elder.getId(), e.getMessage());
            }
        }
    }
}
```

- [ ] Add `sendInactivityAlert` to `SosService.java` (the `sendSms` method is already private — add a new public method that delegates to it):

```java
public void sendInactivityAlert(String toPhone, User elder) {
    String name = elder.getId().toString(); // elder name pulled from profile at UI level; use ID as fallback
    sendSms(toPhone,
        "Your contact on ToWin has not been active for " + INACTIVITY_DAYS +
        " days. Please check in on them.");
}
```

Add `private static final int INACTIVITY_DAYS = 5;` to `SosService.java`.

- [ ] Commit:
```bash
git add backend/src/main/java/com/towin/common/config/SchedulingConfig.java \
        backend/src/main/java/com/towin/emergency/service/InactivityCheckService.java \
        backend/src/main/java/com/towin/emergency/service/SosService.java \
        backend/src/main/java/com/towin/common/repository/UserRepository.java
git commit -m "feat: daily inactivity check — SMS emergency contacts if elder silent 5+ days"
```

---

## Task 5 — POST /api/auth/verify-id (S3 upload → PENDING)

**Files:**
- Create: `backend/src/main/java/com/towin/auth/dto/VerifyIdResponse.java`
- Modify: `backend/src/main/java/com/towin/auth/service/AuthService.java`
- Modify: `backend/src/main/java/com/towin/auth/controller/AuthController.java`

The existing `S3Service.uploadPhoto()` uploads any file; we'll reuse it for ID documents under a `documents/` prefix. Add a new `uploadDocument(UUID userId, MultipartFile file)` method to `S3Service`:

```java
public String uploadDocument(UUID userId, MultipartFile file) {
    String extension = getExtension(file.getOriginalFilename());
    String key = "documents/" + userId + "/" + UUID.randomUUID() + extension;
    try {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket).key(key)
                .contentType(file.getContentType())
                .contentLength(file.getSize())
                .build();
        s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
    } catch (IOException e) {
        throw new IllegalStateException("Failed to upload document", e);
    }
    return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
}
```

- [ ] Create `VerifyIdResponse.java`:

```java
package com.towin.auth.dto;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class VerifyIdResponse {
    private String documentUrl;
    private String verificationStatus;
}
```

- [ ] Add `verifyId` to `AuthService.java`:

```java
@Transactional
public VerifyIdResponse verifyId(UUID userId, MultipartFile file) {
    User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

    String url = s3Service.uploadDocument(userId, file);
    user.setIdDocumentUrl(url);
    user.setVerificationStatus(VerificationStatus.PENDING);
    userRepository.save(user);

    return VerifyIdResponse.builder()
            .documentUrl(url)
            .verificationStatus(VerificationStatus.PENDING.name())
            .build();
}
```

Inject `S3Service s3Service` into `AuthService` (add to constructor via `@RequiredArgsConstructor`).

- [ ] Add endpoint to `AuthController.java`:

```java
@PostMapping("/verify-id")
public ResponseEntity<VerifyIdResponse> verifyId(
        Authentication auth,
        @RequestParam("file") MultipartFile file) {
    UUID userId = UUID.fromString(auth.getName());
    return ResponseEntity.ok(authService.verifyId(userId, file));
}
```

Add `import org.springframework.security.core.Authentication;` and `import org.springframework.web.multipart.MultipartFile;`.

- [ ] Commit:
```bash
git add backend/src/main/java/com/towin/auth/dto/VerifyIdResponse.java \
        backend/src/main/java/com/towin/auth/service/AuthService.java \
        backend/src/main/java/com/towin/auth/controller/AuthController.java \
        backend/src/main/java/com/towin/common/service/S3Service.java
git commit -m "feat: POST /api/auth/verify-id — upload ID doc to S3, set status PENDING"
```

---

## Task 6 — POST /api/auth/verify-phone (OTP via Twilio)

**Files:**
- Create: `backend/src/main/java/com/towin/auth/dto/PhoneOtpRequest.java`
- Create: `backend/src/main/java/com/towin/auth/dto/PhoneVerifyRequest.java`
- Modify: `backend/src/main/java/com/towin/auth/service/AuthService.java`
- Modify: `backend/src/main/java/com/towin/auth/controller/AuthController.java`
- Modify: `backend/src/main/java/com/towin/common/service/TrustScoreService.java` — called after phoneVerified = true

**Flow:**
1. `POST /api/auth/verify-phone/request` — generate 6-digit OTP, store on user + expiry (10 min), SMS it via Twilio
2. `POST /api/auth/verify-phone/confirm` — check OTP matches and not expired, set `phoneVerified = true`, clear OTP, call `TrustScoreService.recalculate()`

- [ ] Create `PhoneOtpRequest.java` (empty — no body needed, phone is from the authenticated user):

```java
package com.towin.auth.dto;

public class PhoneOtpRequest {}
```

- [ ] Create `PhoneVerifyRequest.java`:

```java
package com.towin.auth.dto;

import lombok.Data;

@Data
public class PhoneVerifyRequest {
    private String otp;
}
```

- [ ] Add two methods to `AuthService.java`:

```java
@Transactional
public void requestPhoneOtp(UUID userId) {
    User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

    String otp = String.format("%06d", new java.util.Random().nextInt(1_000_000));
    user.setPhoneOtp(otp);
    user.setPhoneOtpExpiresAt(LocalDateTime.now().plusMinutes(10));
    userRepository.save(user);

    sosService.sendSmsPublic(user.getPhone(), "Your ToWin verification code is: " + otp);
}

@Transactional
public void confirmPhoneOtp(UUID userId, String otp) {
    User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

    if (user.getPhoneOtp() == null || !user.getPhoneOtp().equals(otp)) {
        throw new IllegalArgumentException("Invalid verification code");
    }
    if (user.getPhoneOtpExpiresAt() == null ||
            user.getPhoneOtpExpiresAt().isBefore(LocalDateTime.now())) {
        throw new IllegalArgumentException("Verification code has expired");
    }

    user.setPhoneVerified(true);
    user.setPhoneOtp(null);
    user.setPhoneOtpExpiresAt(null);
    userRepository.save(user);
    trustScoreService.recalculate(userId);
}
```

Inject `SosService sosService` and `TrustScoreService trustScoreService` into `AuthService`.

- [ ] Expose `sendSms` as package-level in `SosService` (rename or add a public wrapper):

```java
// add this public method to SosService:
public void sendSmsPublic(String toNumber, String body) {
    sendSms(toNumber, body);
}
```

- [ ] Add endpoints to `AuthController.java`:

```java
@PostMapping("/verify-phone/request")
public ResponseEntity<Void> requestPhoneOtp(Authentication auth) {
    UUID userId = UUID.fromString(auth.getName());
    authService.requestPhoneOtp(userId);
    return ResponseEntity.ok().build();
}

@PostMapping("/verify-phone/confirm")
public ResponseEntity<Void> confirmPhoneOtp(
        Authentication auth,
        @RequestBody PhoneVerifyRequest request) {
    UUID userId = UUID.fromString(auth.getName());
    authService.confirmPhoneOtp(userId, request.getOtp());
    return ResponseEntity.ok().build();
}
```

- [ ] Commit:
```bash
git add backend/src/main/java/com/towin/auth/dto/PhoneOtpRequest.java \
        backend/src/main/java/com/towin/auth/dto/PhoneVerifyRequest.java \
        backend/src/main/java/com/towin/auth/service/AuthService.java \
        backend/src/main/java/com/towin/auth/controller/AuthController.java \
        backend/src/main/java/com/towin/emergency/service/SosService.java
git commit -m "feat: phone OTP verification — request + confirm, sets phoneVerified + recalculates trust score"
```

---

## Task 7 — Trust-level banners in Messages.jsx

**Files:**
- Modify: `frontend/src/pages/Messages.jsx`

The connection data is already fetched in the `useEffect`. Store the trust level and show a contextual banner below the header.

- [ ] Add `trustLevel` state and populate it from the connection fetch:

```jsx
const [trustLevel, setTrustLevel] = useState(null);

// inside useEffect, update the existing connection fetch:
api.get('/connections').then(r => {
  const conn = r.data.find(c => c.id === connectionId);
  if (conn) {
    setOtherName(conn.otherUserName || 'User');
    setOtherUserId(conn.otherUserId);
    setTrustLevel(conn.currentTrustLevel);
  }
}).catch(() => {});
```

- [ ] Add the banner constant and JSX between `</header>` and the report panel:

```jsx
const TRUST_BANNERS = {
  MESSAGING:  null,  // no banner at base level
  PHONE_CALL: { icon: '📞', text: 'Ready for a phone call? Share your number when comfortable.' },
  VIDEO_CALL: { icon: '🎥', text: 'Time for a video call? Exchange details when ready.' },
  VERIFIED:   { icon: '✅', text: 'Both of you are verified. Trust is growing!' },
  FIRST_MEET: { icon: '🤝', text: 'Planning your first meet? Choose a public place and tell your emergency contacts.' },
  TRUSTED:    { icon: '⭐', text: 'Fully trusted connection. Enjoy your friendship!' },
};
```

Insert JSX after `</header>`:

```jsx
{trustLevel && TRUST_BANNERS[trustLevel] && (
  <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2">
    <span>{TRUST_BANNERS[trustLevel].icon}</span>
    <p className="text-xs text-indigo-700">{TRUST_BANNERS[trustLevel].text}</p>
  </div>
)}
```

- [ ] Commit:
```bash
git add frontend/src/pages/Messages.jsx
git commit -m "feat: show trust-level context banner in Messages page"
```

---

## Task 8 — Frontend: Verification UI on ProfileEdit

**Files:**
- Modify: `frontend/src/pages/ProfileEdit.jsx`

Add two small cards below the profile form:
1. **Phone verification** — "Verify Phone" button → calls `POST /api/auth/verify-phone/request`, then shows OTP input → calls `POST /api/auth/verify-phone/confirm`
2. **ID verification** — file input → calls `POST /api/auth/verify-id` (multipart)

- [ ] Add state variables to `ProfileEdit`:

```jsx
const [phoneOtpSent, setPhoneOtpSent] = useState(false);
const [otp, setOtp] = useState('');
const [otpMsg, setOtpMsg] = useState('');
const [verifyingPhone, setVerifyingPhone] = useState(false);
const [idFile, setIdFile] = useState(null);
const [uploadingId, setUploadingId] = useState(false);
const [idMsg, setIdMsg] = useState('');
```

- [ ] Add handlers:

```jsx
async function requestOtp() {
  setVerifyingPhone(true);
  try {
    await api.post('/auth/verify-phone/request');
    setPhoneOtpSent(true);
    setOtpMsg('Code sent to your phone.');
  } catch (err) {
    setOtpMsg(err?.response?.data?.message || 'Could not send code.');
  } finally { setVerifyingPhone(false); }
}

async function confirmOtp() {
  setVerifyingPhone(true);
  try {
    await api.post('/auth/verify-phone/confirm', { otp });
    setOtpMsg('Phone verified! Trust score updated.');
    setPhoneOtpSent(false);
    setOtp('');
    // Refresh profile data to show updated tier
    const r = await api.get('/profile/me');
    setProfileData(r.data);
  } catch (err) {
    setOtpMsg(err?.response?.data?.message || 'Invalid code.');
  } finally { setVerifyingPhone(false); }
}

async function uploadId() {
  if (!idFile) return;
  setUploadingId(true);
  const form = new FormData();
  form.append('file', idFile);
  try {
    await api.put('/auth/verify-id', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setIdMsg('ID uploaded. Verification pending review.');
  } catch (err) {
    setIdMsg(err?.response?.data?.message || 'Upload failed.');
  } finally { setUploadingId(false); }
}
```

- [ ] Add verification section JSX between the save button and the reviews section:

```jsx
<div className="bg-white rounded-xl shadow-sm p-6 mt-6 space-y-4">
  <h2 className="text-base font-semibold text-gray-800">🔐 Verification</h2>

  {/* Phone */}
  <div className="border rounded-xl p-4 space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-700">Phone Number</p>
      {profileData?.phoneVerified
        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified (+10 pts)</span>
        : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not verified</span>
      }
    </div>
    {!profileData?.phoneVerified && (
      !phoneOtpSent ? (
        <button onClick={requestOtp} disabled={verifyingPhone}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {verifyingPhone ? 'Sending...' : 'Send Verification Code'}
        </button>
      ) : (
        <div className="flex gap-2">
          <input value={otp} onChange={e => setOtp(e.target.value)}
            placeholder="Enter 6-digit code"
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <button onClick={confirmOtp} disabled={verifyingPhone || otp.length < 6}
            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
            Confirm
          </button>
        </div>
      )
    )}
    {otpMsg && <p className={`text-xs ${otpMsg.includes('verified') ? 'text-green-600' : 'text-red-500'}`}>{otpMsg}</p>}
  </div>

  {/* ID */}
  <div className="border rounded-xl p-4 space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-700">ID Document</p>
      {profileData?.verificationStatus === 'VERIFIED'
        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified (+20 pts)</span>
        : profileData?.verificationStatus === 'PENDING'
        ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Under review</span>
        : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not submitted</span>
      }
    </div>
    {profileData?.verificationStatus === 'NONE' && (
      <div className="flex gap-2">
        <input type="file" accept="image/*,.pdf"
          onChange={e => setIdFile(e.target.files[0])}
          className="text-xs text-gray-600" />
        {idFile && (
          <button onClick={uploadId} disabled={uploadingId}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {uploadingId ? 'Uploading...' : 'Upload'}
          </button>
        )}
      </div>
    )}
    {idMsg && <p className={`text-xs ${idMsg.includes('pending') ? 'text-yellow-600' : 'text-red-500'}`}>{idMsg}</p>}
  </div>
</div>
```

Note: `profileData` already includes `verificationStatus` (from ProfileResponse). Need to also add `phoneVerified` to ProfileResponse DTO and populate it in ProfileService.

- [ ] Add `phoneVerified` to `ProfileResponse.java`:
```java
private boolean phoneVerified;
```

- [ ] Populate in `ProfileService.buildProfileResponse()`:
```java
.phoneVerified(user.isPhoneVerified())
```

- [ ] Change the verify-id endpoint method in AuthController to use `@PostMapping` (not `@PutMapping` as mentioned in frontend — keep it `@PostMapping("/verify-id")` consistent with all other auth endpoints).

- [ ] Commit:
```bash
git add frontend/src/pages/ProfileEdit.jsx \
        backend/src/main/java/com/towin/profile/dto/ProfileResponse.java \
        backend/src/main/java/com/towin/profile/service/ProfileService.java
git commit -m "feat: verification UI on ProfileEdit — phone OTP + ID document upload"
```

---

## Task 9 — Final push + update plan doc

- [ ] Update plan doc status to Complete:
  - File: `docs/superpowers/plans/2026-05-11-plan-6-verification-polish.md` — set `Status: Complete`

- [ ] Push branch:
```bash
git push origin plan-5/reviews-trust-reports
```

- [ ] Verify via browser dev tools:
  1. Login as elder → NavBar shows 🆘 SOS button
  2. Open ProfileEdit → Verification section shows "Not verified" for phone and ID
  3. Click "Send Verification Code" → check server logs for Twilio intent
  4. Enter code (from logs if Twilio not configured) → message: "Phone verified!"
  5. Trust score badge updates on ProfileEdit page header
  6. Open a Messages conversation → trust-level banner appears for PHONE_CALL+ connections
  7. Check that the inactivity scheduled task logs on startup (or trigger manually with a test controller)

---

## Key Decisions

- `lastSeenAt` update uses `ApplicationContext.getBean()` in JwtAuthFilter to avoid circular Spring dependency between SecurityConfig → JwtAuthFilter → UserRepository → back to JPA context
- OTP stored directly on User entity (not Redis) — simpler for MVP, avoids Redis dependency for this flow
- `verificationStatus = PENDING` on ID upload — admin reviews manually; no automated approval for MVP
- `sendSmsPublic` wrapper added to SosService so AuthService can send OTP SMSes without duplicating Twilio logic
- Inactivity check cron: `0 0 9 * * *` (09:00 every day) — configurable if needed
- Trust-level banner MESSAGING = null (no banner at base level — that's just the default state)
