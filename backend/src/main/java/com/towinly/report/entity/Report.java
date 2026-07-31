package com.towinly.report.entity;

import com.towinly.common.entity.User;
import com.towinly.common.enums.ReportedContent;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "reports")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @ManyToOne
    @JoinColumn(name = "reported_user_id", nullable = false)
    private User reportedUser;

    @Column(nullable = false)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private String status = "OPEN";

    /**
     * Which one thing this report is about, when it is about a thing and not only a person.
     * Null on every report filed before "What I pass on", and on every report that is still
     * simply about somebody's behaviour.
     *
     * Written only as a pair with {@link #contentId} — the database refuses one without the
     * other — and deliberately not a foreign key: a report is evidence and must outlive the
     * writing complained about, which the elder may well take down the moment she is asked
     * about it.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", length = 20)
    private ReportedContent contentType;

    @Column(name = "content_id")
    private UUID contentId;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
