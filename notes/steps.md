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
