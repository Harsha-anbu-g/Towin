# Plan 2: Trust Progression Engine + Matching & Discovery

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the connection system, discovery feed, and trust progression engine — the core safety differentiator of the ToWin platform.

**Architecture:** Three new Spring Boot modules (`connection`, `discovery`, `trust`), each with Controller/Service/Repository/Entity/DTO following Plan 1 patterns. Two new Flyway migrations. Discovery uses Haversine distance in a native query. Anti-spam tracked via DB count queries. Emergency contact notification at Level 5 is a placeholder log (Twilio in Plan 4).

**Spec:** `docs/superpowers/specs/2026-04-11-towin-platform-design.md`

---

## File Map

**Migrations:**
- `backend/src/main/resources/db/migration/V4__create_connections_table.sql`
- `backend/src/main/resources/db/migration/V5__create_trust_progression_log_table.sql`

**New enums:**
- `com.towin.common.enums.ConnectionType` — SOCIAL, SERVICE
- `com.towin.common.enums.ConnectionStatus` — PENDING, ACTIVE, PAUSED, DECLINED, ENDED
- `com.towin.common.enums.TrustLevel` — DISCOVERED(0), MESSAGING(1), PHONE_CALL(2), VIDEO_CALL(3), VERIFIED(4), FIRST_MEET(5), TRUSTED(6)

**New entities:**
- `com.towin.connection.entity.Connection`
- `com.towin.trust.entity.TrustProgressionLog`

**New repositories:**
- `com.towin.connection.repository.ConnectionRepository`
- `com.towin.trust.repository.TrustProgressionLogRepository`

**New DTOs:**
- `com.towin.connection.dto.ConnectionRequest` — targetUserId, message, type
- `com.towin.connection.dto.ConnectionResponse` — id, otherUser (ProfileResponse), type, status, currentTrustLevel, createdAt
- `com.towin.connection.dto.RespondRequest` — accept (boolean)
- `com.towin.discovery.dto.DiscoverRequest` — radiusKm (default 10), interests[], languages[]
- `com.towin.discovery.dto.DiscoverResponse` — list of UserSummary (userId, name, age, city, trustScore, interests, languages, distanceKm)
- `com.towin.trust.dto.TrustStatusResponse` — connectionId, currentLevel, confirmedByMe, confirmedByOther, isPaused, history[]
- `com.towin.trust.dto.TrustConfirmResponse` — newLevel, message

**New services:**
- `com.towin.connection.service.ConnectionService`
- `com.towin.discovery.service.DiscoveryService`
- `com.towin.trust.service.TrustService`

**New controllers:**
- `com.towin.connection.controller.ConnectionController`
- `com.towin.discovery.controller.DiscoveryController`
- `com.towin.trust.controller.TrustController`

**New tests:**
- `com.towin.connection.service.ConnectionServiceTest`
- `com.towin.trust.service.TrustServiceTest`

---

## Chunk 1: Database Migrations

### Task 1: Flyway V4 — Connections Table

- [ ] **Step 1: Create migration**

`backend/src/main/resources/db/migration/V4__create_connections_table.sql`:
```sql
CREATE TYPE connection_type AS ENUM ('SOCIAL', 'SERVICE');
CREATE TYPE connection_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'DECLINED', 'ENDED');

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type connection_type NOT NULL DEFAULT 'SOCIAL',
    status connection_status NOT NULL DEFAULT 'PENDING',
    current_trust_level INTEGER NOT NULL DEFAULT 0,
    initiated_by UUID NOT NULL REFERENCES users(id),
    request_message TEXT,
    confirmed_by_a BOOLEAN NOT NULL DEFAULT FALSE,
    confirmed_by_b BOOLEAN NOT NULL DEFAULT FALSE,
    is_paused_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_connection CHECK (user_a != user_b),
    CONSTRAINT unique_connection UNIQUE (user_a, user_b)
);

CREATE INDEX idx_connections_user_a ON connections(user_a);
CREATE INDEX idx_connections_user_b ON connections(user_b);
CREATE INDEX idx_connections_status ON connections(status);
```

- [ ] **Step 2: Verify migration runs**

```bash
cd backend && ./mvnw spring-boot:run
```
Expected: Flyway runs V4, `connections` table created.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat: add connections table migration"
```

---

### Task 2: Flyway V5 — Trust Progression Log

- [ ] **Step 1: Create migration**

`backend/src/main/resources/db/migration/V5__create_trust_progression_log_table.sql`:
```sql
CREATE TABLE trust_progression_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    from_level INTEGER NOT NULL,
    to_level INTEGER NOT NULL,
    confirmed_by UUID NOT NULL REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_log_connection ON trust_progression_log(connection_id);
```

- [ ] **Step 2: Verify**

```bash
cd backend && ./mvnw spring-boot:run
```
Expected: Flyway runs V5, `trust_progression_log` table created.

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat: add trust progression log migration"
```

---

## Chunk 2: Enums + Entities + Repositories

### Task 3: Enums + Connection Entity + Repository

- [ ] **Step 1: Create enums**

`com/towin/common/enums/ConnectionType.java`:
```java
package com.towin.common.enums;
public enum ConnectionType { SOCIAL, SERVICE }
```

`com/towin/common/enums/ConnectionStatus.java`:
```java
package com.towin.common.enums;
public enum ConnectionStatus { PENDING, ACTIVE, PAUSED, DECLINED, ENDED }
```

`com/towin/common/enums/TrustLevel.java`:
```java
package com.towin.common.enums;

public enum TrustLevel {
    DISCOVERED(0), MESSAGING(1), PHONE_CALL(2), VIDEO_CALL(3),
    VERIFIED(4), FIRST_MEET(5), TRUSTED(6);

    private final int value;
    TrustLevel(int value) { this.value = value; }
    public int getValue() { return value; }

    public static TrustLevel fromValue(int value) {
        for (TrustLevel level : values()) {
            if (level.value == value) return level;
        }
        throw new IllegalArgumentException("Invalid trust level: " + value);
    }

    public TrustLevel next() {
        int next = this.value + 1;
        return next <= 6 ? fromValue(next) : this;
    }
}
```

- [ ] **Step 2: Create Connection entity**

`com/towin/connection/entity/Connection.java`:
```java
package com.towin.connection.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.TrustLevel;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "connections")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Connection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_a", nullable = false)
    private User userA;

    @ManyToOne
    @JoinColumn(name = "user_b", nullable = false)
    private User userB;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "connection_type")
    @Builder.Default
    private ConnectionType type = ConnectionType.SOCIAL;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "connection_status")
    @Builder.Default
    private ConnectionStatus status = ConnectionStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TrustLevel currentTrustLevel = TrustLevel.DISCOVERED;

    @ManyToOne
    @JoinColumn(name = "initiated_by", nullable = false)
    private User initiatedBy;

    @Column(name = "request_message")
    private String requestMessage;

    @Column(name = "confirmed_by_a")
    @Builder.Default
    private Boolean confirmedByA = false;

    @Column(name = "confirmed_by_b")
    @Builder.Default
    private Boolean confirmedByB = false;

    @ManyToOne
    @JoinColumn(name = "is_paused_by")
    private User isPausedBy;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public boolean isParticipant(UUID userId) {
        return userA.getId().equals(userId) || userB.getId().equals(userId);
    }

    public User getOtherUser(UUID myUserId) {
        return userA.getId().equals(myUserId) ? userB : userA;
    }

    public boolean isConfirmedByUser(UUID userId) {
        return userA.getId().equals(userId) ? confirmedByA : confirmedByB;
    }

    public void setConfirmedByUser(UUID userId, boolean confirmed) {
        if (userA.getId().equals(userId)) confirmedByA = confirmed;
        else confirmedByB = confirmed;
    }
}
```

- [ ] **Step 3: Create ConnectionRepository**

`com/towin/connection/repository/ConnectionRepository.java`:
```java
package com.towin.connection.repository;

import com.towin.common.enums.ConnectionStatus;
import com.towin.connection.entity.Connection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConnectionRepository extends JpaRepository<Connection, UUID> {

    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :userId OR c.userB.id = :userId) AND c.status = :status")
    List<Connection> findByUserAndStatus(@Param("userId") UUID userId, @Param("status") ConnectionStatus status);

    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :userId OR c.userB.id = :userId)")
    List<Connection> findAllByUser(@Param("userId") UUID userId);

    @Query("SELECT c FROM Connection c WHERE (c.userA.id = :a AND c.userB.id = :b) OR (c.userA.id = :b AND c.userB.id = :a)")
    Optional<Connection> findBetweenUsers(@Param("a") UUID userAId, @Param("b") UUID userBId);

    @Query("SELECT COUNT(c) FROM Connection c WHERE c.initiatedBy.id = :userId AND c.createdAt >= :since")
    long countRequestsSince(@Param("userId") UUID userId, @Param("since") LocalDateTime since);

    @Query("SELECT COUNT(c) FROM Connection c WHERE c.initiatedBy.id = :userId AND c.status = 'DECLINED' ORDER BY c.updatedAt DESC")
    long countRecentDeclines(@Param("userId") UUID userId);
}
```

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat: add Connection entity, enums, and repository"
```

---

### Task 4: TrustProgressionLog Entity + Repository

- [ ] **Step 1: Create entity**

`com/towin/trust/entity/TrustProgressionLog.java`:
```java
package com.towin.trust.entity;

import com.towin.common.entity.User;
import com.towin.connection.entity.Connection;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "trust_progression_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrustProgressionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "connection_id", nullable = false)
    private Connection connection;

    @Column(name = "from_level", nullable = false)
    private Integer fromLevel;

    @Column(name = "to_level", nullable = false)
    private Integer toLevel;

    @ManyToOne
    @JoinColumn(name = "confirmed_by", nullable = false)
    private User confirmedBy;

    private String note;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { this.createdAt = LocalDateTime.now(); }
}
```

- [ ] **Step 2: Create repository**

`com/towin/trust/repository/TrustProgressionLogRepository.java`:
```java
package com.towin.trust.repository;

import com.towin.trust.entity.TrustProgressionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TrustProgressionLogRepository extends JpaRepository<TrustProgressionLog, UUID> {
    List<TrustProgressionLog> findByConnectionIdOrderByCreatedAtAsc(UUID connectionId);
}
```

- [ ] **Step 3: Commit**

```bash
git add . && git commit -m "feat: add TrustProgressionLog entity and repository"
```

---

## Chunk 3: Connection Service + Controller

### Task 5: ConnectionService + ConnectionController

- [ ] **Step 1: Create DTOs**

`com/towin/connection/dto/ConnectionRequest.java`:
```java
package com.towin.connection.dto;

import com.towin.common.enums.ConnectionType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.UUID;

@Data
public class ConnectionRequest {
    @NotNull
    private UUID targetUserId;
    private String message;
    @NotNull
    private ConnectionType type;
}
```

`com/towin/connection/dto/RespondRequest.java`:
```java
package com.towin.connection.dto;

import lombok.Data;

@Data
public class RespondRequest {
    private boolean accept;
}
```

`com/towin/connection/dto/ConnectionResponse.java`:
```java
package com.towin.connection.dto;

import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.TrustLevel;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ConnectionResponse {
    private UUID id;
    private UUID otherUserId;
    private String otherUserName;
    private Integer otherUserTrustScore;
    private ConnectionType type;
    private ConnectionStatus status;
    private TrustLevel currentTrustLevel;
    private boolean confirmedByMe;
    private boolean confirmedByOther;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 2: Write failing test**

`com/towin/connection/service/ConnectionServiceTest.java`:
```java
package com.towin.connection.service;

import com.towin.common.entity.User;
import com.towin.common.enums.*;
import com.towin.common.repository.UserRepository;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConnectionServiceTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock UserRepository userRepository;
    @InjectMocks ConnectionService connectionService;

    @Test
    void shouldThrowWhenConnectionAlreadyExists() {
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User sender = buildUser(senderId, UserRole.ELDER);
        User target = buildUser(targetId, UserRole.ELDER);

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(senderId, targetId)).thenReturn(Optional.of(new Connection()));

        ConnectionRequest req = new ConnectionRequest();
        req.setTargetUserId(targetId);
        req.setType(ConnectionType.SOCIAL);

        assertThatThrownBy(() -> connectionService.sendRequest(senderId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already exists");
    }

    @Test
    void shouldThrowWhenDailyLimitReached() {
        UUID senderId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User sender = buildUser(senderId, UserRole.ELDER);
        User target = buildUser(targetId, UserRole.ELDER);

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(connectionRepository.findBetweenUsers(senderId, targetId)).thenReturn(Optional.empty());
        when(connectionRepository.countRequestsSince(eq(senderId), any())).thenReturn(5L);

        ConnectionRequest req = new ConnectionRequest();
        req.setTargetUserId(targetId);
        req.setType(ConnectionType.SOCIAL);

        assertThatThrownBy(() -> connectionService.sendRequest(senderId, req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("limit");
    }

    private User buildUser(UUID id, UserRole role) {
        return User.builder().id(id).email("test@test.com").phone("+1").passwordHash("h")
            .role(role).trustScore(0).verificationStatus(VerificationStatus.NONE).isActive(true).build();
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=ConnectionServiceTest -q
```
Expected: FAIL — ConnectionService not found.

- [ ] **Step 4: Implement ConnectionService**

`com/towin/connection/service/ConnectionService.java`:
```java
package com.towin.connection.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.connection.dto.*;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConnectionService {

    private final ConnectionRepository connectionRepository;
    private final UserRepository userRepository;

    private static final int MAX_DAILY_REQUESTS = 5;

    @Transactional
    public ConnectionResponse sendRequest(UUID senderId, ConnectionRequest request) {
        User sender = userRepository.findById(senderId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User target = userRepository.findById(request.getTargetUserId())
            .orElseThrow(() -> new IllegalArgumentException("Target user not found"));

        connectionRepository.findBetweenUsers(senderId, request.getTargetUserId())
            .ifPresent(c -> { throw new IllegalArgumentException("Connection already exists between these users"); });

        long todayCount = connectionRepository.countRequestsSince(senderId, LocalDateTime.now().minusDays(1));
        if (todayCount >= MAX_DAILY_REQUESTS) {
            throw new IllegalArgumentException("Daily connection request limit of " + MAX_DAILY_REQUESTS + " reached");
        }

        TrustLevel startLevel = calculateStartLevel(sender.getTrustScore());

        Connection connection = Connection.builder()
            .userA(sender)
            .userB(target)
            .type(request.getType())
            .status(ConnectionStatus.PENDING)
            .currentTrustLevel(startLevel)
            .initiatedBy(sender)
            .requestMessage(request.getMessage())
            .build();

        Connection saved = connectionRepository.save(connection);
        return toResponse(saved, senderId);
    }

    @Transactional
    public ConnectionResponse respond(UUID userId, UUID connectionId, boolean accept) {
        Connection connection = connectionRepository.findById(connectionId)
            .orElseThrow(() -> new IllegalArgumentException("Connection not found"));

        if (!connection.getUserB().getId().equals(userId)) {
            throw new IllegalArgumentException("Only the recipient can respond to a connection request");
        }
        if (connection.getStatus() != ConnectionStatus.PENDING) {
            throw new IllegalArgumentException("Connection is not in PENDING state");
        }

        connection.setStatus(accept ? ConnectionStatus.ACTIVE : ConnectionStatus.DECLINED);
        Connection saved = connectionRepository.save(connection);
        return toResponse(saved, userId);
    }

    public List<ConnectionResponse> getMyConnections(UUID userId) {
        return connectionRepository.findAllByUser(userId).stream()
            .filter(c -> c.getStatus() == ConnectionStatus.ACTIVE || c.getStatus() == ConnectionStatus.PAUSED)
            .map(c -> toResponse(c, userId))
            .collect(Collectors.toList());
    }

    private TrustLevel calculateStartLevel(int trustScore) {
        if (trustScore >= 71) return TrustLevel.VERIFIED;
        if (trustScore >= 51) return TrustLevel.PHONE_CALL;
        return TrustLevel.MESSAGING;
    }

    private ConnectionResponse toResponse(Connection c, UUID myUserId) {
        User other = c.getOtherUser(myUserId);
        return ConnectionResponse.builder()
            .id(c.getId())
            .otherUserId(other.getId())
            .otherUserTrustScore(other.getTrustScore())
            .type(c.getType())
            .status(c.getStatus())
            .currentTrustLevel(c.getCurrentTrustLevel())
            .confirmedByMe(c.isConfirmedByUser(myUserId))
            .confirmedByOther(c.isConfirmedByUser(other.getId()))
            .createdAt(c.getCreatedAt())
            .build();
    }
}
```

- [ ] **Step 5: Create ConnectionController**

`com/towin/connection/controller/ConnectionController.java`:
```java
package com.towin.connection.controller;

import com.towin.connection.dto.*;
import com.towin.connection.service.ConnectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins:http://localhost:5173}")
public class ConnectionController {

    private final ConnectionService connectionService;

    @PostMapping("/request")
    public ResponseEntity<ConnectionResponse> sendRequest(
            Authentication auth,
            @Valid @RequestBody ConnectionRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(connectionService.sendRequest(userId, request));
    }

    @PostMapping("/{id}/respond")
    public ResponseEntity<ConnectionResponse> respond(
            Authentication auth,
            @PathVariable UUID id,
            @RequestBody RespondRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(connectionService.respond(userId, id, request.isAccept()));
    }

    @GetMapping
    public ResponseEntity<List<ConnectionResponse>> getMyConnections(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(connectionService.getMyConnections(userId));
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && ./mvnw test -Dtest=ConnectionServiceTest -q
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add . && git commit -m "feat: add connection request, respond, and list endpoints"
```

---

## Chunk 4: Trust Service + Controller

### Task 6: TrustService + TrustController

- [ ] **Step 1: Create DTOs**

`com/towin/trust/dto/TrustStatusResponse.java`:
```java
package com.towin.trust.dto;

import com.towin.common.enums.TrustLevel;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TrustStatusResponse {
    private UUID connectionId;
    private TrustLevel currentLevel;
    private boolean confirmedByMe;
    private boolean confirmedByOther;
    private boolean isPaused;
    private List<LogEntry> history;

    @Data
    @Builder
    public static class LogEntry {
        private int fromLevel;
        private int toLevel;
        private LocalDateTime timestamp;
        private String note;
    }
}
```

`com/towin/trust/dto/TrustActionResponse.java`:
```java
package com.towin.trust.dto;

import com.towin.common.enums.TrustLevel;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TrustActionResponse {
    private TrustLevel currentLevel;
    private String message;
}
```

- [ ] **Step 2: Write failing test**

`com/towin/trust/service/TrustServiceTest.java`:
```java
package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.*;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.trust.entity.TrustProgressionLog;
import com.towin.trust.repository.TrustProgressionLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrustServiceTest {

    @Mock ConnectionRepository connectionRepository;
    @Mock TrustProgressionLogRepository logRepository;
    @Mock UserRepository userRepository;
    @InjectMocks TrustService trustService;

    @Test
    void shouldAdvanceLevelWhenBothConfirm() {
        UUID userAId = UUID.randomUUID();
        UUID userBId = UUID.randomUUID();
        User userA = buildUser(userAId);
        User userB = buildUser(userBId);

        Connection conn = Connection.builder()
            .id(UUID.randomUUID())
            .userA(userA).userB(userB)
            .initiatedBy(userA)
            .currentTrustLevel(TrustLevel.MESSAGING)
            .status(ConnectionStatus.ACTIVE)
            .confirmedByA(false).confirmedByB(false)
            .build();

        when(connectionRepository.findById(conn.getId())).thenReturn(Optional.of(conn));
        when(connectionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(logRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(userRepository.findById(userAId)).thenReturn(Optional.of(userA));

        // User A confirms
        trustService.confirm(userAId, conn.getId());

        // User B confirms — should advance to PHONE_CALL
        trustService.confirm(userBId, conn.getId());

        assertThat(conn.getCurrentTrustLevel()).isEqualTo(TrustLevel.PHONE_CALL);
    }

    @Test
    void shouldThrowWhenConfirmingInactiveConnection() {
        UUID userId = UUID.randomUUID();
        Connection conn = Connection.builder()
            .id(UUID.randomUUID())
            .userA(buildUser(userId)).userB(buildUser(UUID.randomUUID()))
            .initiatedBy(buildUser(userId))
            .currentTrustLevel(TrustLevel.MESSAGING)
            .status(ConnectionStatus.DECLINED)
            .confirmedByA(false).confirmedByB(false)
            .build();

        when(connectionRepository.findById(conn.getId())).thenReturn(Optional.of(conn));

        assertThatThrownBy(() -> trustService.confirm(userId, conn.getId()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not active");
    }

    private User buildUser(UUID id) {
        return User.builder().id(id).email("t@t.com").phone("+1").passwordHash("h")
            .role(UserRole.ELDER).trustScore(0).verificationStatus(VerificationStatus.NONE).isActive(true).build();
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest=TrustServiceTest -q
```
Expected: FAIL — TrustService not found.

- [ ] **Step 4: Implement TrustService**

`com/towin/trust/service/TrustService.java`:
```java
package com.towin.trust.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.common.repository.UserRepository;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.trust.dto.TrustActionResponse;
import com.towin.trust.dto.TrustStatusResponse;
import com.towin.trust.entity.TrustProgressionLog;
import com.towin.trust.repository.TrustProgressionLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrustService {

    private final ConnectionRepository connectionRepository;
    private final TrustProgressionLogRepository logRepository;
    private final UserRepository userRepository;

    @Transactional
    public TrustActionResponse confirm(UUID userId, UUID connectionId) {
        Connection connection = getActiveConnection(userId, connectionId);
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        connection.setConfirmedByUser(userId, true);
        connectionRepository.save(connection);

        if (connection.getConfirmedByA() && connection.getConfirmedByB()) {
            TrustLevel prev = connection.getCurrentTrustLevel();
            TrustLevel next = prev.next();

            if (next != prev) {
                connection.setCurrentTrustLevel(next);
                connection.setConfirmedByA(false);
                connection.setConfirmedByB(false);
                connectionRepository.save(connection);

                logRepository.save(TrustProgressionLog.builder()
                    .connection(connection)
                    .fromLevel(prev.getValue())
                    .toLevel(next.getValue())
                    .confirmedBy(user)
                    .build());

                if (next == TrustLevel.FIRST_MEET) {
                    notifyEmergencyContacts(connection);
                }

                return new TrustActionResponse(next,
                    "Both confirmed — advanced to " + next.name());
            }
        }

        return new TrustActionResponse(connection.getCurrentTrustLevel(),
            "Confirmation recorded. Waiting for the other person.");
    }

    @Transactional
    public TrustActionResponse pause(UUID userId, UUID connectionId) {
        Connection connection = getActiveConnection(userId, connectionId);
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        connection.setStatus(ConnectionStatus.PAUSED);
        connection.setIsPausedBy(user);
        connectionRepository.save(connection);

        return new TrustActionResponse(connection.getCurrentTrustLevel(), "Progression paused.");
    }

    public TrustStatusResponse getStatus(UUID userId, UUID connectionId) {
        Connection connection = connectionRepository.findById(connectionId)
            .orElseThrow(() -> new IllegalArgumentException("Connection not found"));

        if (!connection.isParticipant(userId)) {
            throw new IllegalArgumentException("You are not part of this connection");
        }

        List<TrustProgressionLog> logs = logRepository.findByConnectionIdOrderByCreatedAtAsc(connectionId);

        return TrustStatusResponse.builder()
            .connectionId(connectionId)
            .currentLevel(connection.getCurrentTrustLevel())
            .confirmedByMe(connection.isConfirmedByUser(userId))
            .confirmedByOther(connection.isConfirmedByUser(connection.getOtherUser(userId).getId()))
            .isPaused(connection.getStatus() == ConnectionStatus.PAUSED)
            .history(logs.stream().map(l -> TrustStatusResponse.LogEntry.builder()
                .fromLevel(l.getFromLevel())
                .toLevel(l.getToLevel())
                .timestamp(l.getCreatedAt())
                .note(l.getNote())
                .build()).collect(Collectors.toList()))
            .build();
    }

    private Connection getActiveConnection(UUID userId, UUID connectionId) {
        Connection connection = connectionRepository.findById(connectionId)
            .orElseThrow(() -> new IllegalArgumentException("Connection not found"));

        if (!connection.isParticipant(userId)) {
            throw new IllegalArgumentException("You are not part of this connection");
        }
        if (connection.getStatus() != ConnectionStatus.ACTIVE) {
            throw new IllegalArgumentException("Connection is not active");
        }
        return connection;
    }

    private void notifyEmergencyContacts(Connection connection) {
        // Placeholder — Twilio SMS notification implemented in Plan 4
        log.info("LEVEL 5 MEET: Notifying emergency contacts for connection {} between {} and {}",
            connection.getId(),
            connection.getUserA().getId(),
            connection.getUserB().getId());
    }
}
```

- [ ] **Step 5: Create TrustController**

`com/towin/trust/controller/TrustController.java`:
```java
package com.towin.trust.controller;

import com.towin.trust.dto.TrustActionResponse;
import com.towin.trust.dto.TrustStatusResponse;
import com.towin.trust.service.TrustService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/trust")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins:http://localhost:5173}")
public class TrustController {

    private final TrustService trustService;

    @PostMapping("/{connectionId}/confirm")
    public ResponseEntity<TrustActionResponse> confirm(
            Authentication auth,
            @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(trustService.confirm(userId, connectionId));
    }

    @PostMapping("/{connectionId}/pause")
    public ResponseEntity<TrustActionResponse> pause(
            Authentication auth,
            @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(trustService.pause(userId, connectionId));
    }

    @GetMapping("/{connectionId}/status")
    public ResponseEntity<TrustStatusResponse> getStatus(
            Authentication auth,
            @PathVariable UUID connectionId) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(trustService.getStatus(userId, connectionId));
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest=TrustServiceTest,ConnectionServiceTest -q
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add . && git commit -m "feat: add trust progression confirm, pause, and status endpoints"
```

---

## Chunk 5: Discovery Service + Controller

### Task 7: DiscoveryService + DiscoveryController

- [ ] **Step 1: Create DTOs**

`com/towin/discovery/dto/UserSummary.java`:
```java
package com.towin.discovery.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class UserSummary {
    private UUID userId;
    private String name;
    private Integer age;
    private String city;
    private String photoUrl;
    private Integer trustScore;
    private String verificationStatus;
    private String[] interests;
    private String[] languages;
    private Double distanceKm;
}
```

- [ ] **Step 2: Implement DiscoveryService**

`com/towin/discovery/service/DiscoveryService.java`:
```java
package com.towin.discovery.service;

import com.towin.common.entity.User;
import com.towin.common.enums.UserRole;
import com.towin.common.repository.UserRepository;
import com.towin.discovery.dto.UserSummary;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.entity.HelperProfile;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiscoveryService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;

    public List<UserSummary> discoverElders(UUID requestingUserId, double radiusKm) {
        User me = userRepository.findById(requestingUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (me.getLocationLat() == null || me.getLocationLng() == null) {
            return List.of();
        }

        return userRepository.findAll().stream()
            .filter(u -> !u.getId().equals(requestingUserId))
            .filter(u -> u.getRole() == UserRole.ELDER || u.getRole() == UserRole.BOTH)
            .filter(u -> u.getIsActive())
            .filter(u -> u.getLocationLat() != null && u.getLocationLng() != null)
            .filter(u -> haversineKm(me.getLocationLat(), me.getLocationLng(),
                                     u.getLocationLat(), u.getLocationLng()) <= radiusKm)
            .map(u -> {
                ElderProfile profile = elderProfileRepository.findByUserId(u.getId()).orElse(null);
                double dist = haversineKm(me.getLocationLat(), me.getLocationLng(),
                                          u.getLocationLat(), u.getLocationLng());
                return toSummary(u, profile, null, dist);
            })
            .sorted((a, b) -> Double.compare(a.getDistanceKm(), b.getDistanceKm()))
            .collect(Collectors.toList());
    }

    public List<UserSummary> discoverHelpers(UUID requestingUserId, double radiusKm) {
        User me = userRepository.findById(requestingUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (me.getLocationLat() == null || me.getLocationLng() == null) {
            return List.of();
        }

        return userRepository.findAll().stream()
            .filter(u -> !u.getId().equals(requestingUserId))
            .filter(u -> u.getRole() == UserRole.HELPER || u.getRole() == UserRole.BOTH)
            .filter(u -> u.getIsActive())
            .filter(u -> u.getLocationLat() != null && u.getLocationLng() != null)
            .filter(u -> haversineKm(me.getLocationLat(), me.getLocationLng(),
                                     u.getLocationLat(), u.getLocationLng()) <= radiusKm)
            .map(u -> {
                HelperProfile profile = helperProfileRepository.findByUserId(u.getId()).orElse(null);
                double dist = haversineKm(me.getLocationLat(), me.getLocationLng(),
                                          u.getLocationLat(), u.getLocationLng());
                return toSummary(u, null, profile, dist);
            })
            .sorted((a, b) -> Double.compare(a.getDistanceKm(), b.getDistanceKm()))
            .collect(Collectors.toList());
    }

    private double haversineKm(BigDecimal lat1, BigDecimal lon1, BigDecimal lat2, BigDecimal lon2) {
        double R = 6371.0;
        double dLat = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double dLon = Math.toRadians(lon2.doubleValue() - lon1.doubleValue());
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(Math.toRadians(lat1.doubleValue()))
                 * Math.cos(Math.toRadians(lat2.doubleValue()))
                 * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private UserSummary toSummary(User u, ElderProfile elder, HelperProfile helper, double distKm) {
        UserSummary.UserSummaryBuilder b = UserSummary.builder()
            .userId(u.getId())
            .city(u.getCity())
            .trustScore(u.getTrustScore())
            .verificationStatus(u.getVerificationStatus().name())
            .distanceKm(Math.round(distKm * 10.0) / 10.0);

        if (elder != null) {
            b.name(elder.getName()).age(elder.getAge()).photoUrl(elder.getPhotoUrl())
             .interests(elder.getInterests()).languages(elder.getLanguages());
        } else if (helper != null) {
            b.name(helper.getName()).age(helper.getAge()).photoUrl(helper.getPhotoUrl())
             .interests(helper.getSkillsOffered()).languages(helper.getLanguages());
        }
        return b.build();
    }
}
```

- [ ] **Step 3: Create DiscoveryController**

`com/towin/discovery/controller/DiscoveryController.java`:
```java
package com.towin.discovery.controller;

import com.towin.discovery.dto.UserSummary;
import com.towin.discovery.service.DiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/discover")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins:http://localhost:5173}")
public class DiscoveryController {

    private final DiscoveryService discoveryService;

    @GetMapping("/elders")
    public ResponseEntity<List<UserSummary>> discoverElders(
            Authentication auth,
            @RequestParam(defaultValue = "10") double radiusKm) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(discoveryService.discoverElders(userId, radiusKm));
    }

    @GetMapping("/helpers")
    public ResponseEntity<List<UserSummary>> discoverHelpers(
            Authentication auth,
            @RequestParam(defaultValue = "10") double radiusKm) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(discoveryService.discoverHelpers(userId, radiusKm));
    }
}
```

- [ ] **Step 4: Run all tests**

```bash
cd backend && ./mvnw test -q
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: add discovery endpoints for nearby elders and helpers"
```

---

## Plan 2 Complete

**What was built:**
- Flyway V4 (connections) + V5 (trust_progression_log) migrations
- Connection entity with TrustLevel, ConnectionType, ConnectionStatus enums
- Connection request/respond/list endpoints with anti-spam (5/day limit)
- Trust confirm/pause/status endpoints — both-must-confirm logic
- Level 5 emergency contact notification placeholder
- Discovery feed — nearby elders and helpers sorted by distance (Haversine)

**Next:** Plan 3 — Messaging + Service Mode (posting needs, applying as helper)
