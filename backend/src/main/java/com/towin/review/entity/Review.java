package com.towin.review.entity;

import com.towin.common.entity.User;
import com.towin.need.entity.Need;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "reviews")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "reviewer_id", nullable = false)
    private User reviewer;

    @ManyToOne
    @JoinColumn(name = "reviewee_id", nullable = false)
    private User reviewee;

    @ManyToOne
    @JoinColumn(name = "need_id")
    private Need need;

    /**
     * Guardian mode: the family member who wrote this review for the elder. Null
     * means the elder wrote it themselves. The reviewer stays the elder, because
     * it is their experience of the helper and their trust that backs it — this
     * only says who put it into words.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "acted_by_user_id")
    private User actedBy;

    @Column(nullable = false)
    private Integer rating;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> tags;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "safety_concern", nullable = false)
    @Builder.Default
    private Boolean safetyConcern = false;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
