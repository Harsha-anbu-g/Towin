package com.towin.family.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.DelegatedPower;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One power an elder has delegated to a family member (guardian mode). Presence
 * of a row = granted; the elder is the only one who can create or remove it.
 */
@Entity
@Table(name = "family_delegated_powers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FamilyDelegatedPower {

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

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
