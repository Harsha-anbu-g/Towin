package com.towin.need.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.*;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "needs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Need {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "elder_id", nullable = false)
    private User elder;

    /**
     * Guardian mode: the family member who handled this request for the elder.
     * Null means the elder did it themselves. The request still belongs to the
     * elder — helpers answer them, not their daughter — this only says out loud
     * who is doing the typing.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "acted_by_user_id")
    private User actedBy;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "need_category", nullable = false)
    private NeedCategory category;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "need_schedule")
    @Builder.Default
    private NeedSchedule schedule = NeedSchedule.ONE_TIME;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "need_urgency")
    @Builder.Default
    private NeedUrgency urgency = NeedUrgency.NORMAL;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "need_status")
    @Builder.Default
    private NeedStatus status = NeedStatus.OPEN;

    @Column(name = "location_lat", precision = 10, scale = 8)
    private BigDecimal locationLat;

    @Column(name = "location_lng", precision = 11, scale = 8)
    private BigDecimal locationLng;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

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
