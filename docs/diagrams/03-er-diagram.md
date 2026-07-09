# 3. Entity Relationship — the ToWin database

**Syntax you learn here:** `erDiagram`, entities as blocks with typed fields,
and relationship lines: `||` exactly one, `o|` zero or one, `o{` zero or many.
So `USER ||--o{ NEED : posts` reads "one user posts zero-or-many needs".

Drawn from the real JPA entities (`@JoinColumn` names shown as fields).

```mermaid
erDiagram
    USER {
        uuid id PK
        string email
        string username
        string role "ELDER | HELPER | BOTH | ADMIN"
        double trustScore
        string verificationStatus
        decimal locationLat
        decimal locationLng
    }
    ELDER_PROFILE {
        uuid user_id FK
    }
    HELPER_PROFILE {
        uuid user_id FK
    }
    NEED {
        uuid id PK
        uuid elder_id FK
        string title
        string category
        string status "OPEN | ASSIGNED | COMPLETED | CANCELLED"
        string urgency
    }
    NEED_APPLICATION {
        uuid id PK
        uuid need_id FK
        uuid helper_id FK
        string status "PENDING | ACCEPTED | REJECTED | WITHDRAWN"
    }
    CONNECTION {
        uuid id PK
        uuid user_a FK
        uuid user_b FK
        uuid initiated_by FK
        string status "PENDING | ACTIVE | PAUSED | DECLINED | ENDED"
        string trustLevel "DISCOVERED ... TRUSTED"
    }
    MESSAGE {
        uuid id PK
        uuid connection_id FK
        uuid sender_id FK
        string content
    }
    TRUST_PROGRESSION_LOG {
        uuid id PK
        uuid connection_id FK
        uuid confirmed_by FK
    }
    REVIEW {
        uuid id PK
        uuid reviewer_id FK
        uuid reviewee_id FK
        uuid need_id FK "nullable"
        int rating
    }
    REPORT {
        uuid id PK
        uuid reporter_id FK
        uuid reported_user_id FK
    }
    EMERGENCY_CONTACT {
        uuid id PK
        uuid elder_id FK
        string phone
    }
    USER_STREAK {
        uuid id PK
        uuid user_id FK
        int currentStreak
        int longestStreak
    }

    USER ||--o| ELDER_PROFILE : "has"
    USER ||--o| HELPER_PROFILE : "has"
    USER ||--o{ NEED : "posts (elder)"
    NEED ||--o{ NEED_APPLICATION : "receives"
    USER ||--o{ NEED_APPLICATION : "applies (helper)"
    USER ||--o{ CONNECTION : "user_a"
    USER ||--o{ CONNECTION : "user_b"
    CONNECTION ||--o{ MESSAGE : "contains"
    USER ||--o{ MESSAGE : "sends"
    CONNECTION ||--o{ TRUST_PROGRESSION_LOG : "climbs trust via"
    USER ||--o{ REVIEW : "writes"
    USER ||--o{ REVIEW : "receives"
    NEED |o--o{ REVIEW : "about (optional)"
    USER ||--o{ REPORT : "files"
    USER ||--o{ REPORT : "is reported in"
    USER ||--o{ EMERGENCY_CONTACT : "elder has"
    USER ||--o| USER_STREAK : "has one"
```

Standalone tables not shown: `FEEDBACK` (anonymous allowed) and
`PENDING_REGISTRATION` (email-verification holding area).

**Try changing:** add the `FEEDBACK` entity yourself, or flip a `o{` to `|{`
(one-or-many) and see how the crow's foot changes.
