package com.towinly.reunion.entity;

import com.towinly.common.enums.ReunionGuestState;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One person the elder wants at the reunion. A name and a phone on the
 * organiser's list; never a Towinly account, never a profile.
 */
@Entity
@Table(name = "reunion_guests")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReunionGuest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reunion_id", nullable = false)
    private Reunion reunion;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 40)
    private String phone;

    /** Mobility, hearing, diet, who has their number. Never money. */
    @Column(length = 300)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    @Builder.Default
    private ReunionGuestState state = ReunionGuestState.REMEMBERED;

    /** Checked in on the day. */
    @Column(name = "arrived_at")
    private LocalDateTime arrivedAt;

    /** Confirmed home at the send-off. */
    @Column(name = "home_at")
    private LocalDateTime homeAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
