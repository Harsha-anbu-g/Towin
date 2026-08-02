package com.towinly.passon.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * The elder's own rules for her Sealed box. One row per owner, keyed by the owner itself.
 *
 * The three rules that carry the safety argument live in Postgres, not here — a box one
 * person can open alone is not a lock, and a box everyone must agree on is a permanent
 * deadlock the first time one Keyholder is unreachable. See the checks in V53.
 *
 * The ack columns store a hash of the exact wording the elder was shown, not just a
 * timestamp. A bare timestamp proves nothing once the copy changes, and "this is not a will"
 * is precisely the sentence someone will later dispute.
 */
@Entity
@Table(name = "passon_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PassOnSettings {

    /** Shared primary key: one row per owner, so the owner's id is the row's identity. */
    @Id
    @Column(name = "owner_id", nullable = false, updatable = false)
    private UUID ownerId;

    /** How many Keyholders must agree. Never fewer than two, never all of them. */
    @Column(name = "approvals_needed", nullable = false)
    private Short approvalsNeeded;

    /** How many Keyholders the elder is aiming for: three to five. */
    @Column(name = "keyholder_target", nullable = false)
    private Short keyholderTarget;

    @Column(name = "armed_at")
    private LocalDateTime armedAt;

    /** The seven days in which the elder can undo the whole thing with one tap. */
    @Column(name = "cooling_off_until")
    private LocalDateTime coolingOffUntil;

    @Column(name = "not_a_will_ack_at")
    private LocalDateTime notAWillAckAt;

    // CHAR(64), not VARCHAR — a SHA-256 hex digest is always exactly 64 characters. The
    // explicit JDBC type is what stops Hibernate's validate from reading Postgres's bpchar
    // as a mismatch and refusing to start.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "not_a_will_ack_hash", length = 64)
    private String notAWillAckHash;

    @Column(name = "key_truth_ack_at")
    private LocalDateTime keyTruthAckAt;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "key_truth_ack_hash", length = 64)
    private String keyTruthAckHash;

    @Column(name = "sheet_saved_at")
    private LocalDateTime sheetSavedAt;

    /**
     * The day a person released this owner's things — and the only switch that opens either her
     * Sealed box or the letters she addressed "after I am gone". Null for every living owner.
     *
     * <p>No code path writes it. It is set by hand at the last step of
     * {@code docs/operations/sealed-box-release.md}; see V56 for why there is exactly one of
     * these rather than one per box.
     *
     * <p>{@code updatable = false} is what makes that sentence true rather than remembered. Every
     * JPA write of this row is an update — {@code SealedBoxService.arm}, {@code markSheetSaved},
     * the demo seeder's backdating — and each of them saves the whole entity, so a stray
     * {@code setReleasedAt} anywhere would reach Postgres. Hibernate now leaves the column out of
     * the UPDATE entirely. The operator's own SQL is outside JPA and is unaffected, which is the
     * point: the only hand that can open this is a human hand.
     */
    @Column(name = "released_at", updatable = false)
    private LocalDateTime releasedAt;

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
