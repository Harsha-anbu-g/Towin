# ToWin Admin Panel — Design Spec

**Date:** 2026-05-15
**Branch:** plan-7/admin-panel

## Goal

Build a protected `/admin` route inside the existing React frontend with a matching set of Spring Boot endpoints. The admin can view and delete all data, approve/reject ID verifications, and suspend/unsuspend users. Admin logs in via the same auth system with role `ADMIN`.

---

## Architecture

### Auth
- Add `ADMIN` to the existing `user_role` PostgreSQL enum via Flyway migration (V14)
- Admin registers/logs in via the same `POST /api/auth/login` endpoint
- JWT contains role — frontend checks role on login and redirects to `/admin`
- All `/api/admin/**` endpoints protected by a Spring Security role check (`ROLE_ADMIN`)
- Non-admin users hitting `/admin` are redirected to `/login`
- One hardcoded admin account created via Flyway seed migration (V14)

### Backend
New package: `com.towin.admin` with:
- `AdminController.java` — all admin endpoints
- `AdminService.java` — business logic (hard deletes, approve/reject, suspend)
- DTOs: `AdminUserResponse`, `AdminVerificationResponse`, `AdminReportResponse`, `AdminReviewResponse`, `AdminConnectionResponse`, `AdminNeedResponse`, `AdminMessageResponse`

### Frontend
- New page: `frontend/src/pages/Admin.jsx`
- New route: `/admin` in `App.jsx` — guarded by `AdminRoute` component (redirects non-ADMIN to `/login`)
- 5 tabs: **Users | Verifications | Reports | Reviews | Data**
- Each tab fetches on mount and shows a table with action buttons

---

## Backend Endpoints

### Users
```
GET    /api/admin/users                    — all users (id, email, role, trustScore, trustTier, isActive, verificationStatus, phoneVerified, createdAt)
DELETE /api/admin/users/{id}               — hard delete user + cascade + S3 photo
PUT    /api/admin/users/{id}/suspend       — set isActive = false
PUT    /api/admin/users/{id}/unsuspend     — set isActive = true
DELETE /api/admin/users/{id}/photo         — delete S3 photo, clear photoUrl
```

### Verifications
```
GET  /api/admin/verifications              — users where verificationStatus = PENDING (includes idDocumentUrl)
PUT  /api/admin/verifications/{id}/approve — set VERIFIED, recalculate trust score
PUT  /api/admin/verifications/{id}/reject  — set REJECTED, delete S3 document
```

### Reports
```
GET    /api/admin/reports                  — all reports (reporter, reported, reason, description, createdAt)
DELETE /api/admin/reports/{id}             — delete report
```

### Reviews
```
GET    /api/admin/reviews                  — all reviews (reviewer, reviewee, rating, tags, comment, safetyConcern)
GET    /api/admin/safety-flags             — reviews where safetyConcern = true (same shape, filtered)
DELETE /api/admin/reviews/{id}             — delete review
```

### Data Tables
```
GET    /api/admin/connections              — all connections (userA, userB, trustLevel, status)
DELETE /api/admin/connections/{id}
GET    /api/admin/needs                    — all needs (elder, category, status, createdAt)
DELETE /api/admin/needs/{id}
GET    /api/admin/messages                 — all messages (sender, connectionId, content, createdAt)
DELETE /api/admin/messages/{id}
```

---

## Hard Delete Cascade (User)

When `DELETE /api/admin/users/{id}` is called:
1. Load user's photo URL → delete from S3
2. Load user's ID document URL → delete from S3
3. Delete in order: messages, reviews (as reviewer + reviewee), reports (as reporter + reported), need_applications, needs, emergency_contacts, trust_progression_log, connections, elder_profile / helper_profile
4. Delete user row

All wrapped in a single `@Transactional` method in `AdminService`.

---

## Frontend — Tab Design

### Users Tab
Table columns: Email | Role | Trust Score | Tier | Active | Verified | Joined | Actions
Actions: **Suspend** / **Unsuspend** · **Delete Photo** · **Delete User** (red, confirm dialog)

### Verifications Tab
Table columns: Email | ID Document (link to S3 URL) | Submitted | Actions
Actions: **✓ Approve** (green) · **✗ Reject** (red)

### Reports Tab
Table columns: Reporter | Reported User | Reason | Description | Date | Actions
Actions: **Delete**

### Reviews Tab
Two sub-tabs: All Reviews | ⚠ Safety Flags
Table columns: Reviewer | Reviewee | Rating | Tags | Safety Concern | Date | Actions
Actions: **Delete**

### Data Tab
Four sub-tabs: Connections | Needs | Messages
Each shows a simple table with key fields and a **Delete** button per row.

---

## Security

- `SecurityConfig` adds `requestMatchers("/api/admin/**").hasRole("ADMIN")`
- Frontend `AdminRoute` component reads role from `AuthContext` — redirects non-admin to `/login`
- Admin cannot delete themselves
- All delete actions show a confirmation before firing

---

## Database Migration (V14)

```sql
-- Add ADMIN to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN';

-- Seed admin account (password: admin123 bcrypted)
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

---

## Files Changed

**New:**
- `backend/.../admin/AdminController.java`
- `backend/.../admin/AdminService.java`
- `backend/.../admin/dto/AdminUserResponse.java`
- `backend/.../admin/dto/AdminVerificationResponse.java`
- `backend/.../admin/dto/AdminReportResponse.java`
- `backend/.../admin/dto/AdminReviewResponse.java`
- `backend/.../admin/dto/AdminConnectionResponse.java`
- `backend/.../admin/dto/AdminNeedResponse.java`
- `backend/.../admin/dto/AdminMessageResponse.java`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/components/AdminRoute.jsx`
- `backend/.../resources/db/migration/V14__add_admin_role.sql`

**Modified:**
- `backend/.../common/enums/UserRole.java` — add ADMIN value
- `backend/.../common/security/SecurityConfig.java` — add `/api/admin/**` rule
- `frontend/src/App.jsx` — add `/admin` route with AdminRoute guard
- `frontend/src/context/AuthContext.jsx` — redirect ADMIN role to `/admin` on login
