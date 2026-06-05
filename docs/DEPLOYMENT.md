# ToWin Deployment Runbook

How the live site is wired up, what each piece costs, and how to redeploy or recover.

**Current state**
- Frontend → Vercel: <https://towin.vercel.app>
- Backend → Railway: <https://backend-production-cef3.up.railway.app>
- Postgres → Railway (private network, with public proxy on `zephyr.proxy.rlwy.net`)
- Redis → not deployed (in-memory cache instead)
- Kafka → not deployed (in-process event handling, producer is `Optional<>`)

---

## 1. GitHub source

| Item | Value |
|---|---|
| Repo | `Harsha-anbu-g/Towin` |
| Production branch | `main` |
| Active dev branch | `plan-5/reviews-trust-reports` |

`main` is what Vercel deploys. `plan-5/reviews-trust-reports` is the working branch and is fast-forwarded into `main` on every push (`git push origin plan-5/...:main`).

---

## 2. Vercel — frontend

**Project**: `towin` under `harsha-anbu-g's projects`.

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` (default) |
| Output Directory | `dist` |
| Production Branch | `main` |
| Env var | `VITE_API_BASE_URL=https://backend-production-cef3.up.railway.app/api` |

[`frontend/vercel.json`](../frontend/vercel.json) rewrites all paths to `/index.html` so client-side routes (`/login`, `/dashboard`, etc.) work after a hard refresh.

**Auto-deploy**: every push to `main` triggers a build. Preview deploys for PR branches.

**Manual deploy (CLI)**: `vercel --prod` from `frontend/` (requires `npm i -g vercel` + `vercel login`).

---

## 3. Railway — backend + Postgres

**Project ID**: `7c8febeb-a2ff-4ab3-8275-8038c3cd529d`
**Environment**: `production` (id `355aecd5-af77-4596-af3d-6f3983de6610`)

### Services

| Service | Source | Notes |
|---|---|---|
| `backend` | Dockerfile at `backend/Dockerfile` | Multi-stage Maven build → JRE runtime |
| `Postgres` | `ghcr.io/railwayapp-templates/postgres-ssl:18` | Volume `postgres-volume` mounted at `/var/lib/postgresql/data` |

### Backend env vars

```
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres.railway.internal:5432/railway
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<rotated secret>
JWT_SECRET=<rotated secret>
JWT_EXPIRATION_MS=86400000
CORS_ALLOWED_ORIGINS=https://towin.vercel.app,https://*-harsha-anbu-gs-projects.vercel.app
APP_KAFKA_ENABLED=false   # explicit
# APP_REDIS_ENABLED unset  → defaults to false, ConcurrentMapCacheManager is used
AWS_ACCESS_KEY=dummy      # placeholder until S3 is wired up
AWS_SECRET_KEY=dummy
AWS_REGION=us-east-1
AWS_S3_BUCKET=towin-photos
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

CORS includes the Vercel production domain plus a wildcard for preview deployments under the same Vercel account.

### Deploy command

```bash
railway up ./backend --path-as-root --service backend --detach -m "<message>"
```

`--path-as-root` is required because the Dockerfile and Maven build context are at `backend/`, not the repo root.

### Postgres access

| Path | Host | Port | DB | User |
|---|---|---|---|---|
| Internal (used by backend) | `postgres.railway.internal` | 5432 | `railway` | `postgres` |
| Public proxy (psql / pg_dump) | `zephyr.proxy.rlwy.net` | 44568 | `railway` | `postgres` |

Connect from your laptop:
```bash
PGPASSWORD=<password> psql -h zephyr.proxy.rlwy.net -p 44568 -U postgres -d railway
```

### Dump and restore

```bash
# Dump local → restore to Railway (overwrites prod data)
PGPASSWORD=0000 pg_dump -h localhost -U postgres -d towin \
  --no-owner --no-privileges --clean --if-exists -F p -f /tmp/towin.sql

PGPASSWORD=<railway-pw> psql -h zephyr.proxy.rlwy.net -p 44568 -U postgres -d railway \
  -v ON_ERROR_STOP=1 -f /tmp/towin.sql
```

Restart the backend after a restore so Hibernate gets a fresh connection pool.

---

## 4. Why Redis and Kafka aren't deployed

Both are present in the codebase (so the architecture story for interviews is intact) but gated behind feature flags:

| Service | Flag | Default | Local | Prod |
|---|---|---|---|---|
| Redis cache | `app.redis.enabled` | `false` | `true` (set by `docker-compose.yml`) | unset → in-memory `ConcurrentMapCacheManager` |
| Kafka events | `app.kafka.enabled` | `false` | `true` (set by `docker-compose.yml`) | unset → producer is `Optional.empty()`, `.ifPresent()` no-ops |

This keeps Railway costs minimal. Re-enable on prod by setting `APP_REDIS_ENABLED=true` and provisioning a Redis service, or `APP_KAFKA_ENABLED=true` plus a Kafka broker.

---

## 5. Common operations

### Tail backend logs
```bash
railway logs --service backend
```

### Update a backend env var
```bash
railway variable set KEY=value --service backend
# triggers an automatic redeploy
```

### Restart backend without redeploying
```bash
railway service restart --service backend --yes
```

### List services + their deploy status
```bash
railway service list --json | jq '.[] | {name, status: .latestDeployment.status}'
```

### Check Vercel deploy
Vercel dashboard → `towin` project → Deployments tab. Latest commit on `main` should be marked **Ready**.

---

## 6. Recovery scenarios

**Backend won't start (Flyway / schema error)**
1. `railway logs --service backend` → look for the `Caused by` line.
2. If it's a missing-table error, check `backend/src/main/resources/db/migration/` for the missing migration and write one (`V<N>__<description>.sql`).
3. If it's a checksum mismatch, run `DELETE FROM flyway_schema_history WHERE version='<N>';` against the prod DB and let Flyway re-run the migration.

**Frontend 404s on routes other than `/`**
- Check [`frontend/vercel.json`](../frontend/vercel.json) is committed and pushed. The SPA rewrite must be active.

**CORS errors after a domain change**
- Update `CORS_ALLOWED_ORIGINS` on the backend service → backend auto-redeploys → preflight should return the new origin.

**Lost the JWT secret**
- Generate a new one (`openssl rand -hex 48`), set as `JWT_SECRET`, restart backend. All existing tokens are invalidated; users must log in again.

---

## 7. Cost notes

| Resource | Approx monthly |
|---|---|
| Railway backend (small instance, low traffic) | $5–10 |
| Railway Postgres + volume (~250MB) | $1–2 |
| Vercel Hobby tier | $0 |
| GitHub | $0 |
| Total beta cost | **~$6–12 / month** |

Removing Redis (~$5/mo for the smallest plan) and never deploying Kafka are the main savings vs. running the full local stack.
