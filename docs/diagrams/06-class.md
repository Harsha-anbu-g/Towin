# 6. Class — the Need feature slice, as classes

**Syntax you learn here:** `classDiagram`, members with `+` (public) / `-` (private),
`<<interface>>` and `<<enumeration>>` tags, generics with `~T~` (i.e. `List~Need~`),
and the arrows: `--|>` extends, `-->` has/uses, `..>` depends on.

All names are real — from `com.towin.need`.

```mermaid
classDiagram
    class NeedController {
        +postNeed(auth, NeedRequest) NeedResponse
        +getAllOpen(auth) List~NeedResponse~
        +browseNearby(auth, lat, lng, radiusKm) List~NeedResponse~
        +getMyNeeds(auth, page, size) Page~NeedResponse~
        +apply(auth, needId, ApplyRequest) void
        +acceptHelper(auth, needId, helperId) NeedResponse
        +complete(auth, needId) NeedResponse
        +cancelNeed(auth, needId) void
        +withdrawApplication(auth, needId) void
    }

    class NeedService {
        -NeedRepository needRepository
        +postNeed(elderId, request) NeedResponse
        +getAllOpen(helperId) List~NeedResponse~
        +apply(helperId, needId, request) void
        +acceptHelper(elderId, needId, helperId) NeedResponse
        +complete(elderId, needId) NeedResponse
        +cancelNeed(elderId, needId) void
    }

    class NeedRepository {
        <<interface>>
        +findByStatusOrderByCreatedAtDesc(status) List~Need~
        +findOpenNeedsWithLocation(status) List~Need~
    }

    class JpaRepository {
        <<interface>>
    }

    class Need {
        -UUID id
        -String title
        -NeedCategory category
        -NeedStatus status
        -BigDecimal locationLat
        -BigDecimal locationLng
    }

    class NeedApplication {
        -UUID id
        -String message
        -ApplicationStatus status
    }

    class User {
        -UUID id
        -String username
        -UserRole role
    }

    class NeedStatus {
        <<enumeration>>
        OPEN
        ASSIGNED
        COMPLETED
        CANCELLED
    }

    class ApplicationStatus {
        <<enumeration>>
        PENDING
        ACCEPTED
        REJECTED
        WITHDRAWN
    }

    NeedController --> NeedService : delegates to
    NeedService --> NeedRepository : uses
    NeedRepository --|> JpaRepository : extends
    NeedRepository ..> Need : manages
    Need "1" --> "0..*" NeedApplication : receives
    Need --> "1" User : elder
    NeedApplication --> "1" User : helper
    Need --> NeedStatus : status
    NeedApplication --> ApplicationStatus : status
```

**Read it as:** the classic Spring layering — controller holds no logic and
delegates to the service; the service owns the rules and talks to the repository;
the repository is just an interface that Spring Data implements for you
(that's the `--|> JpaRepository` inheritance).

**Try changing:** draw the messaging slice the same way
(`MessageController → MessageService → MessageRepository → Message`). Every
slice in the backend follows this exact shape, so one template fits all 16.
