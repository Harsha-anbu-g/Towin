package com.towinly.passon.entity;

import com.towinly.common.entity.User;
import com.towinly.common.enums.KeyholderStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Someone the elder has asked to hold a key to her Sealed box.
 *
 * Two-sided consent: the row starts INVITED and only the invited person moves it to ACTIVE.
 * Nobody is conscripted into a duty about a death without being asked.
 *
 * A Keyholder counts toward the threshold only while ACTIVE <em>and</em> a matching ACTIVE
 * family link still exists — re-derived on every read by {@code KeyholderService}, never
 * snapshotted, so a link that ends stops counting immediately.
 */
@Entity
@Table(name = "passon_keyholders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Keyholder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "keyholder_id", nullable = false)
    private User keyholder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private KeyholderStatus status = KeyholderStatus.INVITED;

    @Column(name = "invited_at", nullable = false, updatable = false)
    private LocalDateTime invitedAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @PrePersist
    void onCreate() {
        invitedAt = LocalDateTime.now();
    }
}
