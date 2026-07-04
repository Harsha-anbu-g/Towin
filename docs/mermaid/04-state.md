# 4. State — the lifecycles inside ToWin

**Syntax you learn here:** `stateDiagram-v2`, `[*]` for start/end,
`A --> B : what causes it`, and `note right of`.

All three are real enums from `com.towin.common.enums`.

## Need lifecycle (`NeedStatus`)

```mermaid
stateDiagram-v2
    [*] --> OPEN : elder posts a need
    OPEN --> ASSIGNED : elder accepts a helper<br/>POST /api/needs/{id}/accept/{helperId}
    OPEN --> CANCELLED : elder deletes it
    ASSIGNED --> COMPLETED : marked done<br/>POST /api/needs/{id}/complete
    ASSIGNED --> CANCELLED : called off
    COMPLETED --> [*]
    CANCELLED --> [*]
```

## Connection lifecycle (`ConnectionStatus`)

```mermaid
stateDiagram-v2
    [*] --> PENDING : POST /api/connections/request
    PENDING --> ACTIVE : other person accepts
    PENDING --> DECLINED : other person declines
    ACTIVE --> PAUSED : POST /api/trust/{id}/pause
    PAUSED --> ACTIVE : POST /api/trust/{id}/resume
    ACTIVE --> ENDED : DELETE /api/connections/{id}
    DECLINED --> [*]
    ENDED --> [*]
```

## Trust ladder (`TrustLevel`) — one direction only, both people confirm each step

```mermaid
stateDiagram-v2
    direction LR
    [*] --> DISCOVERED
    DISCOVERED --> MESSAGING
    MESSAGING --> PHONE_CALL
    PHONE_CALL --> VIDEO_CALL
    VIDEO_CALL --> VERIFIED
    VERIFIED --> FIRST_MEET
    FIRST_MEET --> TRUSTED
    TRUSTED --> [*]
    note right of TRUSTED : Fully Trusted —<br/>both confirmed every step
```

**Try changing:** `ApplicationStatus` is the one lifecycle not drawn here
(PENDING → ACCEPTED / REJECTED / WITHDRAWN). Draw it yourself — it's 5 lines.
