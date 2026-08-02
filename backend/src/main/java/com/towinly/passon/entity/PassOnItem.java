package com.towinly.passon.entity;

import com.towinly.common.entity.User;
import com.towinly.common.enums.PassOnAudience;
import com.towinly.common.enums.PassOnKind;
import com.towinly.common.enums.PassOnRelease;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One story or one letter. {@link #kind} discriminates: a story is written to a group, a
 * letter to one named person.
 *
 * {@link #audience} is the elder's stated intent and nothing more. It is never the answer to
 * "may this person read this" — that is re-derived on every read by
 * {@code PassOnVisibilityService}, in the {@code FamilyStandingService} style, so a friendship
 * that ended yesterday stops granting access today without anything being rewritten.
 */
@Entity
@Table(name = "passon_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PassOnItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private PassOnKind kind;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private PassOnAudience audience;

    /**
     * The one person a letter is addressed to. Goes null rather than blocking the delete when
     * that person closes their account — see the deliberately one-directional
     * {@code ck_passon_person} check in V50.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audience_user_id")
    private User audienceUser;

    /**
     * NOW for everything a story ever is, and for most letters. AFTER is a letter she means to
     * be read after she is gone: it stays shut to the person it names until somebody has run
     * the release procedure by hand for this owner — see {@code ReleaseGate}.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "release_when", nullable = false, length = 6)
    @Builder.Default
    private PassOnRelease releaseWhen = PassOnRelease.NOW;

    /** Set once, the first time the addressed person opens it — "Sarah read this on 3 June". */
    @Column(name = "first_read_at")
    private LocalDateTime firstReadAt;

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
