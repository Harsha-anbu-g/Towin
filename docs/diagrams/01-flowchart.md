# 1. Flowchart — how a request flows through ToWin

**Syntax you learn here:** `flowchart TB` (top-bottom) or `LR` (left-right),
nodes `A[box]`, `B([rounded])`, `C[(database)]`, arrows `-->`, labels `-- text -->`,
and `subgraph` for grouping.

```mermaid
flowchart TB
    U([Elder / Helper])

    subgraph FE["Frontend — React + Vite (Vercel)"]
        P["pages/ (25 screens)<br/>Dashboards, Messages, Trust, Streaks..."]
        CTX["context/<br/>AuthContext, ToastContext"]
        AX["api/axios.js<br/>adds Bearer JWT to every call"]
        P --> CTX
        P --> AX
    end

    subgraph BE["Backend — Spring Boot (Railway)"]
        F["JwtAuthFilter<br/>checks the token"]
        subgraph SLICE["one slice per feature (x16)"]
            direction LR
            CO["Controller"] --> SV["Service"] --> RE["Repository"]
        end
        F --> CO
    end

    DB[("PostgreSQL")]

    U --> P
    AX -- "HTTPS: /api/**" --> F
    RE --> DB
```

**Read it as:** every screen talks to one file (`axios.js`), which talks to one
gatekeeper (`JwtAuthFilter`), which hands off to the right feature slice
(auth, need, connection, messaging, trust, streak, review, report, emergency,
feedback, discovery, profile, admin, account, geocoding, oauth).

**Try changing:** `flowchart TB` → `flowchart LR` and re-render. Add a node for
Redis or S3 and draw an arrow from the backend.
