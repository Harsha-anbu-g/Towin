# 2. Sequence — who calls whom, in what order

**Syntax you learn here:** `sequenceDiagram`, `participant X as Label`,
solid arrow `->>` (call), dashed arrow `-->>` (response), `Note over`, and
`alt / else / end` for branching.

## Login (real flow from AuthController)

```mermaid
sequenceDiagram
    participant B as Browser (Login.jsx)
    participant A as axios.js
    participant C as AuthController
    participant S as AuthService
    participant D as PostgreSQL

    B->>A: submit email + password
    A->>C: POST /api/auth/login
    C->>S: login(request)
    S->>D: find user by email
    D-->>S: user row
    alt password matches (BCrypt)
        S-->>C: JWT (signed, 24h)
        C-->>B: 200 { token, user }
        Note over B: token saved,<br/>axios adds it to every call
    else wrong password
        S-->>C: error
        C-->>B: 401 Unauthorized
    end
```

## An authorized call (apply to a need)

```mermaid
sequenceDiagram
    participant B as Browser (HelperDashboard.jsx)
    participant F as JwtAuthFilter
    participant N as NeedController
    participant S as NeedService
    participant D as PostgreSQL

    B->>F: POST /api/needs/{id}/apply  (Bearer JWT)
    F->>F: validate token, load user
    F->>N: authenticated request
    N->>S: apply(needId, helper)
    S->>D: insert NeedApplication (status=PENDING)
    D-->>S: saved
    S-->>N: application
    N-->>B: 200 OK
    Note over B: elder later calls<br/>POST /api/needs/{id}/accept/{helperId}
```

**Try changing:** add a `participant R as Redis` and show a cache check before
the database. Or draw the SOS flow: `POST /api/emergency/sos` → Twilio.
