# Railway Deployment Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy ToWin (Spring Boot backend + React/Vite frontend + Postgres + Redis) to Railway on a fresh project so the site is publicly accessible.

**Architecture:** Single Railway project with four resources — `postgres` (managed plugin), `redis` (managed plugin), `backend` (Spring Boot service from `/backend`), `frontend` (Vite static build from `/frontend`). Kafka is gated behind `app.kafka.enabled` and stays off in production; producers become no-ops so the connection-accept flow keeps working without the notification logger. Backend reads its port from `$PORT` and DB connection from Railway's injected `DATABASE_URL`. Frontend reads its API base URL from `VITE_API_BASE_URL` at build time.

**Tech Stack:** Railway CLI, Spring Boot 3, Maven, Java 17, Vite, React 19, Postgres 16, Redis 7.

---

## Pre-flight Assumptions

- User has a Railway account on the workspace tied to `agharsha.anbu@gmail.com`.
- User can paste secrets when prompted (JWT_SECRET, optional AWS creds, optional Twilio creds).
- Branch `plan-5/reviews-trust-reports` is the deploy source. We do **not** merge to `main` first — Railway deploys whatever branch the service is linked to.
- Pre-existing test failures on this branch are out of scope for this deploy plan (documented separately).

---

## Chunk 1: Make the backend Railway-ready

### Task 1.1: Gate Kafka behind a property so the app starts without a broker

**Files:**
- Modify: [backend/src/main/java/com/towin/common/config/KafkaConfig.java](backend/src/main/java/com/towin/common/config/KafkaConfig.java)
- Modify: [backend/src/main/java/com/towin/common/messaging/ConnectionEventProducer.java](backend/src/main/java/com/towin/common/messaging/ConnectionEventProducer.java)
- Modify: [backend/src/main/java/com/towin/common/messaging/ConnectionEventConsumer.java](backend/src/main/java/com/towin/common/messaging/ConnectionEventConsumer.java)
- Modify: [backend/src/main/java/com/towin/connection/service/ConnectionService.java](backend/src/main/java/com/towin/connection/service/ConnectionService.java)
- Modify: [backend/src/main/java/com/towin/need/service/NeedService.java](backend/src/main/java/com/towin/need/service/NeedService.java)
- Modify: [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml)

- [ ] **Step 1: Add an `@ConditionalOnProperty` gate to each Kafka bean**

In `KafkaConfig.java`, `ConnectionEventProducer.java`, `ConnectionEventConsumer.java`, add at the class level:

```java
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    prefix = "app.kafka", name = "enabled", havingValue = "true", matchIfMissing = false)
```

This prevents the beans from being created when Kafka is disabled.

- [ ] **Step 2: Make injection of `ConnectionEventProducer` optional in callers**

In `ConnectionService.java` and `NeedService.java`, change:

```java
private final ConnectionEventProducer eventProducer;
```

to:

```java
private final java.util.Optional<ConnectionEventProducer> eventProducer;
```

Then wrap each `.send(...)` call:

```java
eventProducer.ifPresent(p -> p.send(event));
```

- [ ] **Step 3: Disable Kafka auto-config and add the property in `application.yml`**

Add to the top-level `spring` section:

```yaml
spring:
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration
```

Remove the `spring.kafka:` block entirely (it's now unused).

Add at the bottom of the file:

```yaml
app:
  kafka:
    enabled: ${APP_KAFKA_ENABLED:false}
```

- [ ] **Step 4: Build and verify the app starts without a broker**

Run: `cd backend && ./mvnw -q -DskipTests package`
Expected: `BUILD SUCCESS`.

Run: `cd backend && SPRING_PROFILES_ACTIVE=default DB_USERNAME=postgres DB_PASSWORD=0000 java -jar target/backend-*.jar` (uses local Postgres — if you don't have it, skip and rely on the cloud-side verification in Chunk 4).
Expected: app starts; logs show no Kafka connection attempts.

Kill with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/towin/common/config/KafkaConfig.java \
        backend/src/main/java/com/towin/common/messaging/ConnectionEventProducer.java \
        backend/src/main/java/com/towin/common/messaging/ConnectionEventConsumer.java \
        backend/src/main/java/com/towin/connection/service/ConnectionService.java \
        backend/src/main/java/com/towin/need/service/NeedService.java \
        backend/src/main/resources/application.yml
git commit -m "feat: gate Kafka behind app.kafka.enabled so the app boots without a broker"
```

---

### Task 1.2: Bind Spring to Railway's `$PORT` and parse `DATABASE_URL`

**Files:**
- Modify: [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml)

- [ ] **Step 1: Replace hardcoded port and DB block**

Replace the existing `spring.datasource` block:

```yaml
  datasource:
    url: jdbc:postgresql://localhost:5432/towin
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:0000}
```

with one that prefers explicit overrides but falls back to local defaults:

```yaml
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/towin}
    username: ${SPRING_DATASOURCE_USERNAME:${DB_USERNAME:postgres}}
    password: ${SPRING_DATASOURCE_PASSWORD:${DB_PASSWORD:0000}}
```

Replace the bottom `server` block:

```yaml
server:
  port: 8080
```

with:

```yaml
server:
  port: ${PORT:8080}
```

Replace the `spring.data.redis` block:

```yaml
  data:
    redis:
      host: ${SPRING_REDIS_HOST:localhost}
      port: 6379
```

with:

```yaml
  data:
    redis:
      host: ${REDIS_HOST:${SPRING_REDIS_HOST:localhost}}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}
```

> **Note on `DATABASE_URL`:** Railway's Postgres plugin exposes both `DATABASE_URL` (libpq format like `postgresql://user:pass@host:port/db`) and the discrete `PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT` variables. Spring needs the JDBC form. In Chunk 4 we'll set `SPRING_DATASOURCE_URL=jdbc:postgresql://${PGHOST}:${PGPORT}/${PGDATABASE}` and the username/password to the matching `${PGUSER}/${PGPASSWORD}` references in Railway's variable editor.

- [ ] **Step 2: Verify the file still parses**

Run: `cd backend && ./mvnw -q -DskipTests package`
Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/application.yml
git commit -m "feat: backend reads PORT, DATABASE_URL, and REDIS_* from env for Railway"
```

---

### Task 1.3: Add a backend Dockerfile (multi-stage, JDK 17)

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.6

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/backend-*.jar /app/app.jar
EXPOSE 8080
ENV JAVA_OPTS=""
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
```

- [ ] **Step 2: Write `.dockerignore`**

```
target/
.idea/
.vscode/
*.iml
.git/
```

- [ ] **Step 3: Local sanity build (optional — skip if Docker isn't running)**

Run: `cd backend && docker build -t towin-backend:test .`
Expected: image builds; final stage tag `towin-backend:test` appears in `docker images`.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat: add multi-stage Dockerfile for backend"
```

---

## Chunk 2: Make the frontend Railway-ready

### Task 2.1: Drive the API base URL from `VITE_API_BASE_URL`

**Files:**
- Modify: [frontend/src/api/axios.js](frontend/src/api/axios.js)
- Create: `frontend/.env.example`

- [ ] **Step 1: Replace the hardcoded baseURL**

In `frontend/src/api/axios.js`, change:

```js
const api = axios.create({
  baseURL: 'http://localhost:8080/api',
});
```

to:

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
});
```

- [ ] **Step 2: Write `frontend/.env.example`**

```
VITE_API_BASE_URL=http://localhost:8080/api
```

- [ ] **Step 3: Verify local dev still works**

Run: `cd frontend && npm run build`
Expected: build succeeds; `dist/` contains `index.html` and an `assets/` folder.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/axios.js frontend/.env.example
git commit -m "feat: frontend reads API base URL from VITE_API_BASE_URL"
```

---

### Task 2.2: Add a static-serve Dockerfile for the frontend

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/.dockerignore`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Write `nginx.conf` (SPA fallback + Railway `$PORT`)**

```nginx
server {
  listen       __PORT__;
  server_name  _;
  root         /usr/share/nginx/html;
  index        index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV PORT=8080
CMD ["/bin/sh", "-c", "envsubst '$$PORT' < /etc/nginx/templates/default.conf.template | sed 's/__PORT__/'\"$PORT\"'/' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```

- [ ] **Step 3: Write `.dockerignore`**

```
node_modules/
dist/
.git/
.vscode/
```

- [ ] **Step 4: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore frontend/nginx.conf
git commit -m "feat: add nginx-based Dockerfile for frontend static serve"
```

---

## Chunk 3: Provision Railway infra

### Task 3.1: Install the Railway CLI and authenticate

- [ ] **Step 1: Install via Homebrew**

Run: `brew install railway`
Expected: `which railway` prints a path; `railway --version` prints a semver.

- [ ] **Step 2: Log in**

Run: `railway login`
Expected: browser opens; after auth, `railway whoami --json` returns the workspace tied to `agharsha.anbu@gmail.com`.

---

### Task 3.2: Create the project and link it to this repo

- [ ] **Step 1: Initialize the project from the repo root**

Run: `cd /Users/aghar/Documents/Projects/ToWin && railway init --name towin`
Expected: prompts for workspace; confirm. `railway status --json` shows `projectName: "towin"`, environment `production`.

---

### Task 3.3: Add Postgres and Redis plugins

- [ ] **Step 1: Add Postgres**

Run: `railway add --database postgres`
Expected: service named `Postgres` appears; `railway variable list --service Postgres --json` shows `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.

- [ ] **Step 2: Add Redis**

Run: `railway add --database redis`
Expected: service named `Redis` appears; variables include `REDIS_URL`, `REDISHOST`, `REDISPORT`, `REDISPASSWORD`.

---

### Task 3.4: Add the `backend` service and configure it

- [ ] **Step 1: Add the service pointing at the GitHub repo's backend folder**

Run: `railway add --service backend`
When prompted for the source, choose the GitHub repo and select the current branch (`plan-5/reviews-trust-reports`). After creation:

Run: `railway service backend` (sets context).
Run: `railway variable set RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`
Run: `railway variable set RAILWAY_ROOT_DIRECTORY=backend`

> **Note:** If your Railway plan supports `--rootDirectory` via the CLI, prefer that; otherwise set it in the dashboard for the service.

- [ ] **Step 2: Wire env vars (use Railway's reference syntax to pull from the plugins)**

Run each of these (Railway expands `${{ Postgres.PGHOST }}` etc. at deploy time):

```bash
railway variable set 'SPRING_DATASOURCE_URL=jdbc:postgresql://${{ Postgres.PGHOST }}:${{ Postgres.PGPORT }}/${{ Postgres.PGDATABASE }}'
railway variable set 'SPRING_DATASOURCE_USERNAME=${{ Postgres.PGUSER }}'
railway variable set 'SPRING_DATASOURCE_PASSWORD=${{ Postgres.PGPASSWORD }}'
railway variable set 'REDIS_HOST=${{ Redis.REDISHOST }}'
railway variable set 'REDIS_PORT=${{ Redis.REDISPORT }}'
railway variable set 'REDIS_PASSWORD=${{ Redis.REDISPASSWORD }}'
railway variable set 'APP_KAFKA_ENABLED=false'
railway variable set "JWT_SECRET=$(openssl rand -hex 48)"
railway variable set 'JWT_EXPIRATION_MS=86400000'
```

For AWS/Twilio (set placeholders now; rotate later):

```bash
railway variable set 'AWS_REGION=us-east-1'
railway variable set 'AWS_ACCESS_KEY=dummy'
railway variable set 'AWS_SECRET_KEY=dummy'
railway variable set 'AWS_S3_BUCKET=towin-photos'
railway variable set 'TWILIO_ACCOUNT_SID='
railway variable set 'TWILIO_AUTH_TOKEN='
railway variable set 'TWILIO_FROM_NUMBER='
```

CORS will be set after we know the frontend's URL (Task 3.6).

- [ ] **Step 3: Trigger first deploy**

Run: `railway up --detach -m "initial backend deploy"`
Expected: build kicks off; `railway logs --service backend --lines 200` streams build output.

- [ ] **Step 4: Wait for `Listening on port` log line and a public domain**

Run: `railway domain --service backend` (generates a `*.up.railway.app` URL if none).
Expected: a URL like `https://backend-production-xxxx.up.railway.app`. Save this as `$BACKEND_URL`.

Sanity check: `curl -sS $BACKEND_URL/actuator/health || curl -sSI $BACKEND_URL/` — should return HTTP 200 / 401 / 404 (anything not 502).

---

### Task 3.5: Add the `frontend` service and configure it

- [ ] **Step 1: Add the service**

Run: `railway add --service frontend`
Source: same repo/branch.

Run: `railway service frontend`
Run: `railway variable set RAILWAY_DOCKERFILE_PATH=frontend/Dockerfile`
Run: `railway variable set RAILWAY_ROOT_DIRECTORY=frontend`

- [ ] **Step 2: Set the API base URL as a build-time arg**

The Vite app inlines `VITE_API_BASE_URL` at build time, so we set it on the service. Railway forwards env vars as Docker `ARG`s when they match `--build-arg` names in the Dockerfile (we declared `ARG VITE_API_BASE_URL`).

Run: `railway variable set "VITE_API_BASE_URL=$BACKEND_URL/api"` (substitute the URL captured in 3.4 Step 4).

- [ ] **Step 3: Deploy and generate a domain**

Run: `railway up --detach -m "initial frontend deploy"`
Run: `railway domain --service frontend`
Expected: URL like `https://frontend-production-xxxx.up.railway.app`. Save as `$FRONTEND_URL`.

---

### Task 3.6: Close the CORS loop and verify end-to-end

- [ ] **Step 1: Set CORS on the backend**

Run:
```bash
railway service backend
railway variable set "CORS_ALLOWED_ORIGINS=$FRONTEND_URL"
railway redeploy --service backend
```

Expected: backend redeploys; logs show no errors.

- [ ] **Step 2: Manual smoke test**

Open `$FRONTEND_URL` in a browser.
- Register a new user.
- Log in.
- Land on the dashboard.
- Open browser devtools → Network tab → confirm requests go to `$BACKEND_URL/api/...` and return 200/201.
- No CORS errors in the console.

- [ ] **Step 3: Commit any final config tweaks (none expected) and report URLs**

If any backend/frontend config changed during smoke testing, commit it on the deploy branch. Otherwise:

```
Deployed:
  Frontend: $FRONTEND_URL
  Backend:  $BACKEND_URL
```

---

## Out of Scope (follow-ups, not blockers)

- **Pre-existing test failures** (`JwtUtilTest`, `ConnectionServiceTest`, `MessageServiceTest`, `TrustScoreServiceTest`, `NeedServiceTest.shouldAcceptHelper`) — unrelated to deploy, will be fixed in a dedicated branch.
- **Custom domain** (e.g. `towin.app`) — can be added later via `railway domain add --service frontend <hostname>` once DNS is ready.
- **Real S3 / Twilio credentials** — placeholders for now; file uploads and SMS will fail until real keys are set. The rest of the site works.
- **Kafka in production** — re-enable later if/when push notifications are built out.
- **CI/CD on `main`** — Railway is currently pointed at the feature branch. After this deploy is verified, decide whether to merge to `main` and re-point Railway, or keep deploying from the branch.
