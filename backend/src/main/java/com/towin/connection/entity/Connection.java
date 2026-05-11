package com.towin.connection.entity;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.TrustLevel;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "connections")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Connection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_a", nullable = false)
    private User userA;

    @ManyToOne
    @JoinColumn(name = "user_b", nullable = false)
    private User userB;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "connection_type")
    @Builder.Default
    private ConnectionType type = ConnectionType.SOCIAL;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(columnDefinition = "connection_status")
    @Builder.Default
    private ConnectionStatus status = ConnectionStatus.PENDING;

    @Column(name = "current_trust_level")
    @Builder.Default
    private TrustLevel currentTrustLevel = TrustLevel.DISCOVERED;

    @ManyToOne
    @JoinColumn(name = "initiated_by", nullable = false)
    private User initiatedBy;

    @Column(name = "request_message")
    private String requestMessage;

    @Column(name = "confirmed_by_a")
    @Builder.Default
    private Boolean confirmedByA = false;

    @Column(name = "confirmed_by_b")
    @Builder.Default
    private Boolean confirmedByB = false;

    @ManyToOne
    @JoinColumn(name = "is_paused_by")
    private User isPausedBy;

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

    public boolean isParticipant(UUID userId) {
        return userA.getId().equals(userId) || userB.getId().equals(userId);
    }

    public User getOtherUser(UUID myUserId) {
        return userA.getId().equals(myUserId) ? userB : userA;
    }

    public boolean isConfirmedByUser(UUID userId) {
        return userA.getId().equals(userId) ? confirmedByA : confirmedByB;
    }

    public void setConfirmedByUser(UUID userId, boolean confirmed) {
        if (userA.getId().equals(userId)) confirmedByA = confirmed;
        else confirmedByB = confirmed;
    }
}
