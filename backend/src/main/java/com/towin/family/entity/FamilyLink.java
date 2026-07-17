package com.towin.family.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.FamilyLinkStatus;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "family_links")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FamilyLink {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elder_id", nullable = false)
    private User elder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_user_id", nullable = false)
    private User familyUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "initiated_by", nullable = false)
    private User initiatedBy;

    @Column(length = 100)
    private String relationship;

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private Boolean isPrimary = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private FamilyLinkStatus status = FamilyLinkStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
