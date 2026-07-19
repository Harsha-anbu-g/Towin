package com.towin.family.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyStandingState;
import com.towin.connection.entity.Connection;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A family member's opt-out on one inherited standing (keyed by the elder's
 * shared connection). The standing itself is derived, never stored — see
 * FamilyStandingService. No row = active.
 */
@Entity
@Table(name = "family_standing_controls")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FamilyStandingControl {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_user_id", nullable = false)
    private User familyUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elder_connection_id", nullable = false)
    private Connection elderConnection;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FamilyStandingState state;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
