package com.towinly.family.entity;

import com.towinly.common.entity.User;
import com.towinly.common.enums.DelegatedPower;
import com.towinly.common.enums.PowerRequestStatus;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A family member's ask for one delegated power. Only the family side of an
 * ACTIVE link may create one; only the elder may answer it. A row here never
 * grants anything — approval writes the grant into family_delegated_powers.
 */
@Entity
@Table(name = "family_power_requests")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FamilyPowerRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elder_id", nullable = false)
    private User elder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_user_id", nullable = false)
    private User familyUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DelegatedPower power;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private PowerRequestStatus status = PowerRequestStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
