# ToWin — What We've Built

## Plan 1 — Auth + User Profiles ✅

- Spring Boot + React project scaffolded
- PostgreSQL DB with Flyway migrations (V1, V2, V3)
- `users`, `elder_profiles`, `helper_profiles` tables
- JWT auth (register + login) — `/api/auth/register`, `/api/auth/login`
- Spring Security with `JwtAuthFilter`
- Elder + Helper profile CRUD — `/api/profile/me`, `/api/profile/{id}`
- React auth pages: Register, Login, PrivateRoute, AuthContext
- Global exception handler

## Plan 2 — Trust Progression Engine 🔄

**Done:**
- V4 migration: `connections` table (connection_type, connection_status enums)
- V5 migration: `trust_progression_log` table
- `TrustLevel` enum (DISCOVERED → TRUSTED, values 0–6) with `next()` helper
- `TrustLevelConverter` — maps TrustLevel ↔ INTEGER in DB
- `Connection` entity + `ConnectionRepository`
- `TrustProgressionLog` entity + `TrustProgressionLogRepository`
- `ConnectionService` — sendRequest (10/day limit), respond (accept/decline), getMyConnections
- Connection DTOs: `ConnectionRequest`, `ConnectionResponse`, `RespondToConnectionRequest`

**Remaining:**
- `ConnectionController` + `ConnectionServiceTest`
- `TrustService` + `TrustController` + tests (both-must-confirm to advance level)
- `DiscoveryService` + `DiscoveryController` (Haversine location filter)

## Plan 7 — Admin Panel ✅

- V14 migration: `ADMIN` added to `user_role` enum
- V15 migration: seeded `admin@towin.com` (password: `password`)
- `com.towin.admin` package: `AdminController` + `AdminService` + 7 DTOs
- All `/api/admin/**` endpoints secured with `hasAuthority("ADMIN")`
- JWT now stores `role` claim — `JwtAuthFilter` sets `SimpleGrantedAuthority`
- Hard delete cascade: messages → reviews → reports → need_applications → needs → emergency_contacts → trust_progression_log → connections → profiles → user
- ID verification approve/reject (with S3 document deletion on reject)
- User suspend/unsuspend + photo delete via S3
- Frontend: `Admin.jsx` (5 tabs: Users, Verifications, Reports, Reviews, Data)
- Frontend: `AdminRoute` guard — non-ADMIN users redirected to `/login`
- Login auto-redirects ADMIN role to `/admin`
