package com.towinly.reunion.entity;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ReunionOrganiserKind;
import com.towinly.common.enums.ReunionStep;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One reunion: an elder's wish to see old classmates or colleagues again, the
 * person the elder chose to organise it, the plan, and where on the seven
 * steps it stands. Guests live in {@link ReunionGuest}.
 */
@Entity
@Table(name = "reunions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Reunion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "elder_id", nullable = false)
    private User elder;

    /** Null until the elder picks someone on the "Who plans" step. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organiser_id")
    private User organiser;

    @Enumerated(EnumType.STRING)
    @Column(name = "organiser_kind", length = 10)
    private ReunionOrganiserKind organiserKind;

    /** The college, school or workplace. "B.Sc. batch, Presidency College". */
    @Column(nullable = false, length = 200)
    private String institution;

    @Column(length = 60)
    private String years;

    @Column(length = 120)
    private String city;

    /** Names remembered, in the elder's words. */
    @Column(columnDefinition = "TEXT")
    private String note;

    /** The day, in words the elder reads: "Sunday 14 December, 11 in the morning". */
    @Column(name = "planned_on", length = 200)
    private String plannedOn;

    @Column(length = 300)
    private String venue;

    @Column(columnDefinition = "TEXT")
    private String rides;

    @Column(columnDefinition = "TEXT")
    private String food;

    @Column(length = 120)
    private String budget;

    @Column(name = "thank_you", columnDefinition = "TEXT")
    private String thankYou;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    @Builder.Default
    private ReunionStep step = ReunionStep.ORGANISER;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
