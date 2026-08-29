package com.towinly.block.entity;

import com.towinly.common.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One person hiding another (HARD-106). {@code blocker} chose it; {@code blocked} is never
 * told. The pair is unique and can never be the same account twice (both enforced by the
 * table, V58). Rows go with the account: deleting either user cascades.
 */
@Entity
@Table(name = "user_blocks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocker_user_id", nullable = false)
    private User blocker;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "blocked_user_id", nullable = false)
    private User blocked;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void stampCreatedAt() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
