# Towinly Deployment Runbook

How the live site is wired up, what each piece costs, and how to redeploy or recover.

**Current state**
- Frontend → Vercel: <https://www.towinly.com> (apex `towinly.com` redirects here; `towin.vercel.app` still resolves)
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

### Analytics (PostHog), and the one page it must not see

`VITE_PUBLIC_POSTHOG_KEY` and `VITE_PUBLIC_POSTHOG_HOST` are set in the Vercel project. With no
key, `main.jsx` renders the app without the provider and nothing is sent at all.

"What I pass on" is excluded from analytics, because session replay would otherwise hold a video of
an elderly woman reading her own last words. Two of the three controls are in the code and tested
(`frontend/src/lib/analytics.js`, `analytics.test.js`):

1. **Autocapture is off** on `/what-i-pass-on*` and `/passed-on/*` (`autocapture.url_ignorelist`).
2. **Every element rendering her words carries `ph-no-capture`**, which session replay blocks and
   autocapture refuses to read. `maskAllInputs` does not do this — it masks what is *typed*, never
   what is already on the page.
3. **Not in the code, and still to be done in the PostHog project itself**: add `/what-i-pass-on`
   and `/passed-on/` to the session-replay URL blocklist, under the project's session-replay
   settings. PostHog delivers that list from its own server (`urlBlocklist` arrives in the remote
   config, it is not an option this app can pass at start-up), so no change in this repository can
   make it — control 2 is what stands in for it until somebody sets it.

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
JWT_SECRET=${JWT_SECRET}   # set in Railway environment variables — never commit the actual value
JWT_EXPIRATION_MS=86400000
CORS_ALLOWED_ORIGINS=https://www.towinly.com,https://towinly.com,https://towin.vercel.app
APP_VERIFY_BASE_URL=https://www.towinly.com          # base of email verify + password reset links
APP_OAUTH_FRONTEND_REDIRECT=https://www.towinly.com  # where Google sign-in lands after the backend callback
APP_KAFKA_ENABLED=false   # explicit
# APP_REDIS_ENABLED unset  → defaults to false, ConcurrentMapCacheManager is used
AWS_ACCESS_KEY=dummy      # placeholder until S3 is wired up
AWS_SECRET_KEY=dummy
AWS_REGION=us-east-1
AWS_S3_BUCKET=towin-photos
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
ADMIN_EMAIL=            # see "Secrets that switch a feature on or off" below
ADMIN_PASSWORD=
GROQ_API_KEY=
SEALED_BOX_MASTER_KEY=
SEALED_BOX_RELEASE_CONTACT_EMAIL=
```

CORS lists three explicit origins: the custom domain, its apex, and the old `towin.vercel.app` (kept alive so links on already-submitted resumes still work). There is no preview-deployment wildcard.

The three domain-bearing variables above must all change together if the domain ever changes again. Google sign-in is started by the backend (`/oauth2/authorization/google`), so the redirect URI registered in Google Cloud Console points at the Railway backend and does **not** need updating when the frontend domain changes.

### Secrets that switch a feature on or off

None of these live in the repository. Each is blank by default, and a blank value turns its feature
off quietly rather than crashing the app — which means **a missing one is invisible until somebody
goes looking for the feature**.

| Variable | Blank means | If it is lost |
|---|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No admin account is created at boot (`AdminSeeder`) | Set new ones and restart; the account is re-seeded |
| `GROQ_API_KEY` | The Ask-AI assistant is off and says so | Get another key from Groq. Nothing is lost |
| `SEALED_BOX_MASTER_KEY` | Every Sealed box endpoint refuses with a plain "unavailable" message, and **no new box can be armed** | **Every existing Sealed box is destroyed. Permanently. Read the next section before you touch this variable.** |
| `SEALED_BOX_RELEASE_CONTACT_EMAIL` | The saved one-page copy says plainly that no address has been set yet, instead of telling a family where to write | Set it again and restart. Copies already saved by elders still carry the old address, so treat a change as a forwarding problem, not a config change |

#### `SEALED_BOX_MASTER_KEY` — the one secret that cannot be regenerated

Every other secret here can be replaced. This one cannot, because it is not a credential — it is
the key that every sealed item was encrypted under.

- **Format**: base64 of exactly 32 random bytes — `openssl rand -base64 32`.
- **Read by exactly one class**, `SealedCryptoService`. Never in Postgres, never in a log, never
  returned by any endpoint.
- **Checked at boot**: the app encrypts and decrypts a known constant through the real code path.
  A malformed key, a wrong length, or a JCE provider that cannot do AES-256-GCM is caught then —
  the box switches off rather than writing rows nobody could ever decrypt. Look for
  `Sealed box armed: master key loaded and the startup self-check round-tripped.` in the boot log.
- **Losing it destroys every box irrecoverably.** Not "makes them hard to read" — the ciphertext in
  `passon_sealed_items` becomes permanently meaningless, including in every database backup you
  hold, because the key was never in the database. What is lost is where elderly people said their
  money, their papers and their keys are. There is no recovery, no support path, and nothing to
  apologise with.

**Recovery procedure — this is the whole of it, and it has to be done before there is a problem:**

1. Generate the key once, on a machine you trust: `openssl rand -base64 32`.
2. Set it in Railway → `backend` service → Variables. Confirm the boot line above appears.
3. Store a copy **outside Railway and outside this repository**, in a password manager entry named
   so that somebody who is not you would recognise what it is. Railway is the running copy, not the
   backup: an account lockout, a billing lapse or a deleted service takes it with it.
4. Give a second person their own copy, by a route that is not email. See below.
5. Write down the date it was generated. It is never rotated on a schedule — see rotation below.
6. Test the restore, once: set the variable on a scratch environment from the stored copy and
   confirm an item written under it opens.

**Second holder: UNSET. This blocks launch.** One person holding the only copy of this key means
one lost laptop, one hospital stay or one forgotten password destroys every box in the product. The
second holder needs to be a real named person who can be reached independently, who knows what the
string is for, and who is written into
[`docs/operations/sealed-box-release.md`](operations/sealed-box-release.md) as the person who
answers when the first is unreachable.

**Rotation.** `passon_sealed_items.key_version` exists so the key can be replaced without
re-encrypting bodies: a new key gets the next version, new items are wrapped under it, and old rows
are re-wrapped in the background. **That background re-wrap is not built.** Until it is, replacing
the key is not a rotation, it is a deletion. Do not change the value of this variable.

#### `SEALED_BOX_RELEASE_CONTACT_EMAIL` — the address printed on a page a family keeps

Where a family writes when the day comes. It is the only route they have into the manual release
procedure in [`docs/operations/sealed-box-release.md`](operations/sealed-box-release.md), and it is
**printed on the one-page copy an elder saves and keeps with her will** — read years later, by
somebody in the week after a death.

- **Format**: one email address, on a domain that receives mail, going to a mailbox somebody reads.
  Not a no-reply. Not a form. The spec's launch gate is a named human with a stated turnaround.
- **Read by exactly one class**, `ReleaseContact`, and sent to the browser on `/api/passon/sheet`
  and `/api/passon/setup`. It is not a secret — it is meant to be published — so it is logged at
  boot: look for `Sealed box release contact is set to …`.
- **Blank is a supported state and is said out loud.** With nothing set, the saved copy reads
  *"Towinly has not set an address to write to yet."* and the boot log carries
  `Sealed box release contact is NOT SET.` There is deliberately no default: an invented address on
  the real domain would look real to a grieving family, take their letter, and give them no way of
  finding out it went nowhere. An admission is the only honest answer, and it is one they can act
  on.
- **Changing it does not reach copies already saved.** Every sheet an elder has downloaded carries
  the address that was configured on the day she saved it. Keep any address that has ever shipped
  forwarding to the new one, indefinitely — for this variable a change is a forwarding problem, not
  a config change.

### One replica, and only one

The backend runs as a single Railway instance and **everything in it assumes that**. There is no
ShedLock, no Postgres advisory lock and no leader election anywhere in the codebase.

Nothing in v1 depends on this — "What I pass on" deliberately ships with no scheduled job, and the
after-death release is a human procedure, not a cron. There are exactly three pieces of recurring
work today:

| What | Where | On two replicas |
|---|---|---|
| Inactivity check, daily at 09:00 | `InactivityCheckService` | **Two emails to the same family.** Untidy, not dangerous |
| Rate-limiter sweep | `RateLimiterSweeper` | Harmless — the map it sweeps is per-instance anyway |
| Demo data reset, debounced | `DemoResetCoordinator` | Harmless — each instance re-seeds the same fixed content |

**This is recorded here because the next scheduled job is the one that breaks.** Scaling the
service to two replicas, or adding a v2 job that advances a release state, sends a nudge or opens a
box, means two instances doing it at once — two emails to a grieving family, or two releases from a
single quorum. Add a lock **before** the job, not after the incident.

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
