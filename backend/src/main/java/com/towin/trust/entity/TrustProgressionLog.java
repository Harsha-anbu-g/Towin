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

    @Column(name = "note")
    private String note;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
