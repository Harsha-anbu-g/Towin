package com.towinly.passon.entity;

import com.towinly.common.enums.PassOnOpenKind;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One line in the record the elder can read back: what happened to her Sealed box and when.
 *
 * Append-only by convention, not by trigger — an immutable trigger on a table carrying
 * identifiers would contradict the published promise that personal data is removed within
 * thirty days, and that contradiction gets resolved in copy before it is enforced in Postgres.
 *
 * Two fields are deliberately not associations. {@link #ownerId} carries no foreign key and
 * {@link #actorLabel} is a name written down, not a link to an account, so the row survives
 * that person deleting their account instead of breaking {@code DELETE /api/account}.
 * {@link #sealedItemId} is a bare id for the same reason: the database nulls it when the item
 * goes, and a lazy association to a deleted row would only invite an exception.
 */
@Entity
@Table(name = "passon_opens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PassOnOpen {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    @Column(name = "sealed_item_id")
    private UUID sealedItemId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private PassOnOpenKind kind;

    @Column(name = "at", nullable = false, updatable = false)
    private LocalDateTime at;

    /** A name as it stood at the time, never a user id. */
    @Column(name = "actor_label", nullable = false, length = 60)
    private String actorLabel;

    @Column(length = 300)
    private String note;

    @PrePersist
    void onCreate() {
        if (at == null) at = LocalDateTime.now();
    }
}
