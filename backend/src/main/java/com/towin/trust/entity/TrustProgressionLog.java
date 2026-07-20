package com.towin.trust.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.TrustLevel;
import com.towin.connection.entity.Connection;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "trust_progression_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrustProgressionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "connection_id", nullable = false)
    private Connection connection;

    @Column(name = "from_level", nullable = false)
    private TrustLevel fromLevel;

    @Column(name = "to_level", nullable = false)
    private TrustLevel toLevel;

    @ManyToOne
    @JoinColumn(name = "confirmed_by", nullable = false)
    private User confirmedBy;

    /**
     * Guardian mode: the family member who took this step for the elder. Null
     * means the elder took it themselves. confirmedBy stays the elder, because
     * the trust being built is genuinely theirs — this records whose hand was
     * on the button, so the history can never quietly overstate what the elder
     * did for themselves.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "acted_by_user_id")
    private User actedBy;

    @Column(name = "note")
    private String note;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
