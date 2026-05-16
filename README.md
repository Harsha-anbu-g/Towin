# ToWin

A social platform connecting elderly people with each other and with younger helpers — built around a **trust journey** that gradually unlocks contact and meeting capabilities as users earn each other's confidence.

---

## What it does

- **Connections with progressive trust** — pairs of users move through trust levels (message → phone → meet), with both parties having to confirm before progression.
- **Need posting & applications** — elders post needs; helpers apply.
- **Messaging** with WebSocket delivery and trust-gated phone reveal.
- **Emergency contacts & SOS** — inactivity checks and emergency contact escalation.
- **Reviews & reports** for safety and accountability.
- **Admin panel** for moderation.

For the full product story see [`docs/ToWin-Business-Pitch.docx`](docs/ToWin-Business-Pitch.docx) and architecture details in [`docs/ToWin-Technical-Documentation.docx`](docs/ToWin-Technical-Documentation.docx).

---

## Tech stack

**Backend** — Java 21, Spring Boot, Spring Security (JWT), Spring Data JPA, PostgreSQL, Flyway, Redis, Kafka, AWS S3.

**Frontend** — React 19, Vite, Tailwind CSS v4, React Router 7, TanStack Query, Radix UI, Framer Motion.

**Infra** — Docker Compose (Postgres, Redis, Zookeeper, Kafka, app).

---

## Repository layout

```
ToWin/
├── backend/                 Spring Boot service
│   └── src/main/java/com/towin/
│       ├── auth/            registration, login, JWT
│       ├── profile/         elder & helper profiles
│       ├── connection/      trust-level state machine
│       ├── trust/           trust score + progression log
│       ├── messaging/       chat + WebSocket
│       ├── need/            need posts & applications
│       ├── emergency/       SOS + emergency contacts
│       ├── review/          post-interaction reviews
│       ├── report/          user reports
│       ├── admin/           admin endpoints
│       ├── discovery/       helper / need search
│       └── common/          security, S3, trust service, shared entities
├── frontend/                React + Vite SPA
├── docs/
│   ├── superpowers/         specs and plans
│   ├── ToWin-Business-Pitch.docx
│   └── ToWin-Technical-Documentation.docx
└── docker-compose.yml
```

---

## Running locally

### 1. Prerequisites
- Java 21, Maven
- Node 20+, npm
- Docker (for Postgres / Redis / Kafka via compose)

### 2. Configure environment
Copy `.env.example` to `.env` and fill in values (DB credentials, JWT secret, S3, etc.):
```bash
cp .env.example .env
```

### 3. Start infra
```bash
docker compose up -d postgres redis kafka
```

### 4. Backend
```bash
cd backend
./mvnw spring-boot:run
```
Flyway migrations run automatically on boot. The API listens on `http://localhost:8080`.

### 5. Frontend
```bash
cd frontend
npm install
npm run dev
```
Vite serves on `http://localhost:5173`.

---

## Key concepts

### Trust journey
A `Connection` between two users carries a `currentTrustLevel`. To advance, **both users** must confirm at the current step; on advancement, confirmations reset and the next level's contact channel unlocks (e.g. phone number is exposed in `ConnectionResponse` once `PHONE_CALL` is reached).

### Roles
- `ELDER` — posts needs, builds connections, can have emergency contacts.
- `HELPER` — applies to needs, builds connections.
- `ADMIN` — moderation surface.

---

## Documentation

- **Specs & plans:** [`docs/superpowers/`](docs/superpowers/)
- **Business pitch (Word):** [`docs/ToWin-Business-Pitch.docx`](docs/ToWin-Business-Pitch.docx)
- **Technical documentation (Word):** [`docs/ToWin-Technical-Documentation.docx`](docs/ToWin-Technical-Documentation.docx)
